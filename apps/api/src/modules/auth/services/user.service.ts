import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Organization } from '../entities/organization.entity';
import { Team } from '../entities/team.entity';
import * as bcrypt from 'bcryptjs';
import { environment } from '../../../config/environment';
import { LoggerService } from '@observability/logger.service';

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface UserWithRoles extends User {
  roleNames?: string[];
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationsRepository: Repository<Organization>,
    @InjectRepository(Team)
    private teamsRepository: Repository<Team>,
    private logger: LoggerService,
  ) {}

  async findById(userId: string, organizationId: string): Promise<UserWithRoles> {
    const user = await this.usersRepository.findOne({
      where: { id: userId, organizationId },
      relations: ['roles'],
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const userWithRoles = user as UserWithRoles;
    userWithRoles.roleNames = user.roles?.map((r) => r.name) || [];

    return userWithRoles;
  }

  async findByEmail(email: string, organizationId: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email, organizationId },
      relations: ['roles'],
    });
  }

  async listUsers(organizationId: string, limit: number = 20, offset: number = 0) {
    const [users, total] = await this.usersRepository.findAndCount({
      where: { organizationId, deletedAt: null },
      relations: ['roles'],
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    return {
      users: users.map((u) => {
        const userWithRoles = u as UserWithRoles;
        userWithRoles.roleNames = u.roles?.map((r) => r.name) || [];
        return userWithRoles;
      }),
      total,
      limit,
      offset,
    };
  }

  async createUser(
    organizationId: string,
    data: CreateUserDto,
    createdBy: string,
  ): Promise<User> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: data.email, organizationId },
    });

    if (existingUser) {
      throw new ConflictException(`User with email ${data.email} already exists`);
    }

    let passwordHash: string | undefined;
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, environment.auth.saltRounds);
    }

    const user = await this.usersRepository.save({
      organizationId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      avatarUrl: data.avatarUrl,
      passwordHash,
    });

    this.logger.log(`User created: ${data.email} by ${createdBy}`, 'UserService');

    return user;
  }

  async updateUser(
    userId: string,
    organizationId: string,
    data: UpdateUserDto,
    updatedBy: string,
  ): Promise<User> {
    const user = await this.findById(userId, organizationId);

    const updateData: Partial<User> = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    await this.usersRepository.update({ id: userId }, updateData);

    this.logger.log(`User updated: ${userId} by ${updatedBy}`, 'UserService');

    return this.usersRepository.findOne({ where: { id: userId } });
  }

  async deleteUser(userId: string, organizationId: string, deletedBy: string): Promise<void> {
    const user = await this.findById(userId, organizationId);

    await this.usersRepository.update(
      { id: userId },
      { deletedAt: new Date() },
    );

    this.logger.log(`User deleted: ${userId} by ${deletedBy}`, 'UserService');
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new NotFoundException('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, environment.auth.saltRounds);
    await this.usersRepository.update({ id: userId }, { passwordHash: newPasswordHash });

    this.logger.log(`Password changed for user: ${userId}`, 'UserService');
  }

  async resetPassword(userId: string, newPassword: string, resetBy: string): Promise<void> {
    const newPasswordHash = await bcrypt.hash(newPassword, environment.auth.saltRounds);
    await this.usersRepository.update({ id: userId }, { passwordHash: newPasswordHash });

    this.logger.log(`Password reset for user: ${userId} by ${resetBy}`, 'UserService');
  }

  async enableMFA(userId: string, method: 'totp' | 'sms' | 'email', secret?: string): Promise<string | void> {
    if (method === 'totp' && !secret) {
      const totp = this.generateTOTPSecret();
      await this.usersRepository.update(
        { id: userId },
        { mfaEnabled: true, mfaMethod: 'totp', mfaSecret: totp },
      );
      return totp;
    }

    await this.usersRepository.update(
      { id: userId },
      { mfaEnabled: true, mfaMethod: method },
    );
  }

  async disableMFA(userId: string): Promise<void> {
    await this.usersRepository.update(
      { id: userId },
      { mfaEnabled: false, mfaMethod: null, mfaSecret: null },
    );
  }

  private generateTOTPSecret(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
