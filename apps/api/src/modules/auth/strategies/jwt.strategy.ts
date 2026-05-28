import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { environment } from '../../../config/environment';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: environment.jwt.secret,
    });
  }

  async validate(payload: any) {
    try {
      const user = await this.authService.validateUser(payload.sub, payload.organizationId);
      return {
        userId: user.id,
        email: user.email,
        organizationId: user.organizationId,
        roles: payload.roles || [],
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
