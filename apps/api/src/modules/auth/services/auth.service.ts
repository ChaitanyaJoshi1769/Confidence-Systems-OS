import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { Organization } from '../entities/organization.entity';
import { environment } from '../../../config/environment';
import { LoggerService } from '@observability/logger.service';
import * as crypto from 'crypto';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  organizationName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface TokenPayload {
  sub: string; // user id
  organizationId: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Organization)
    private organizationsRepository: Repository<Organization>,
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
    private jwtService: JwtService,
    private logger: LoggerService,
  ) {}

  async signup(data: SignupData): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const { organizationName, email, password, firstName, lastName } = data;

    // Check if user exists
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create organization
    const organization = await this.organizationsRepository.save({
      name: organizationName,
      slug: this.generateSlug(organizationName),
      tier: 'standard',
      maxUsers: 100,
      maxWorkflows: 1000,
    });

    // Hash password
    const passwordHash = await bcrypt.hash(password, environment.auth.saltRounds);

    // Create user
    const user = await this.usersRepository.save({
      organizationId: organization.id,
      email,
      firstName,
      lastName,
      passwordHash,
      emailVerified: false,
    });

    this.logger.log(`User created: ${email}`, 'AuthService');

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    return { user, accessToken, refreshToken };
  }

  async login(credentials: LoginCredentials, ipAddress: string, userAgent: string): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
  }> {
    const { email, password } = credentials;

    // Find user with password
    const user = await this.usersRepository.findOne({
      where: { email },
      select: ['id', 'organizationId', 'email', 'passwordHash', 'firstName', 'lastName', 'mfaEnabled'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    await this.usersRepository.update(user.id, {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
      lastLoginUserAgent: userAgent,
    });

    this.logger.log(`User logged in: ${email}`, 'AuthService');

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    // Store session
    await this.createSession(user, accessToken, refreshToken, ipAddress, userAgent);

    return { user, accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string, ipAddress: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: environment.jwt.refreshSecret,
      }) as TokenPayload;

      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const tokens = await this.generateTokens(user);

      this.logger.log(`Token refreshed for user: ${user.email}`, 'AuthService');

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.sessionsRepository.update(
      { id: sessionId, userId },
      { revokedAt: new Date() },
    );

    this.logger.log(`User logged out: ${userId}`, 'AuthService');
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      return this.jwtService.verify(token, {
        secret: environment.jwt.secret,
      }) as TokenPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async validateUser(userId: string, organizationId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId, organizationId },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: TokenPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      roles: [],
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: environment.jwt.secret,
      expiresIn: environment.jwt.expiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: environment.jwt.refreshSecret,
      expiresIn: environment.jwt.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  private async createSession(
    user: User,
    accessToken: string,
    refreshToken: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<Session> {
    const accessTokenHash = this.hashToken(accessToken);
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    return this.sessionsRepository.save({
      userId: user.id,
      accessTokenHash,
      refreshTokenHash,
      ipAddress,
      userAgent,
      expiresAt,
      refreshExpiresAt,
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}
