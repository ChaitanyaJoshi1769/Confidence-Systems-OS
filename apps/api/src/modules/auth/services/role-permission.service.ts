import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { User } from '../entities/user.entity';
import { LoggerService } from '@observability/logger.service';

@Injectable()
export class RolePermissionService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private logger: LoggerService,
  ) {}

  async createRole(organizationId: string, name: string, description?: string): Promise<Role> {
    const role = await this.rolesRepository.save({
      organizationId,
      name,
      description,
      roleType: 'custom',
    });

    this.logger.log(`Role created: ${name}`, 'RolePermissionService');
    return role;
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
    organizationId: string,
    grantedBy: string,
  ): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId, organizationId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.rolesRepository.findOne({
      where: { id: roleId, organizationId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!user.roles) {
      user.roles = [];
    }

    if (user.roles.some((r) => r.id === roleId)) {
      throw new BadRequestException('User already has this role');
    }

    user.roles.push(role);
    await this.usersRepository.save(user);

    this.logger.log(`Role assigned: ${roleId} to user ${userId}`, 'RolePermissionService');
  }

  async removeRoleFromUser(
    userId: string,
    roleId: string,
    organizationId: string,
  ): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { id: userId, organizationId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.roles = user.roles?.filter((r) => r.id !== roleId) || [];
    await this.usersRepository.save(user);

    this.logger.log(`Role removed: ${roleId} from user ${userId}`, 'RolePermissionService');
  }

  async getUserPermissions(userId: string, organizationId: string): Promise<string[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId, organizationId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissions = new Set<string>();
    user.roles?.forEach((role) => {
      role.permissions?.forEach((permission) => {
        permissions.add(`${permission.resource}:${permission.action}`);
      });
    });

    return Array.from(permissions);
  }

  async hasPermission(
    userId: string,
    organizationId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, organizationId);
    return permissions.includes(`${resource}:${action}`);
  }

  async listRoles(organizationId: string): Promise<Role[]> {
    return this.rolesRepository.find({
      where: { organizationId },
      relations: ['permissions'],
    });
  }

  async getRole(roleId: string, organizationId: string): Promise<Role> {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId, organizationId },
      relations: ['permissions'],
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async deleteRole(roleId: string, organizationId: string): Promise<void> {
    const role = await this.getRole(roleId, organizationId);

    if (role.roleType === 'system') {
      throw new BadRequestException('Cannot delete system roles');
    }

    await this.rolesRepository.delete({ id: roleId });

    this.logger.log(`Role deleted: ${roleId}`, 'RolePermissionService');
  }
}
