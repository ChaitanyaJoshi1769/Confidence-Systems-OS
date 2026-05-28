import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { environment } from '../../config/environment';

// Entities
import { User } from './entities/user.entity';
import { Organization } from './entities/organization.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { Session } from './entities/session.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Department } from './entities/department.entity';
import { Team } from './entities/team.entity';

// Services
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { RolePermissionService } from './services/role-permission.service';
import { AuditService } from './services/audit.service';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { UserController } from './controllers/user.controller';
import { RoleController } from './controllers/role.controller';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Organization,
      Role,
      Permission,
      Session,
      AuditLog,
      Department,
      Team,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: environment.jwt.secret,
      signOptions: { expiresIn: environment.jwt.expiresIn },
    }),
  ],
  controllers: [AuthController, UserController, RoleController],
  providers: [AuthService, UserService, RolePermissionService, AuditService, JwtStrategy, LocalStrategy],
  exports: [AuthService, UserService, RolePermissionService, AuditService],
})
export class AuthModule {}
