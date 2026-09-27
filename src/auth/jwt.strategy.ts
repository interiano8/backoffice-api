import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    const secret = process.env.JWT_SECRET;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'SECRET_KEY_DEV_CHANGE_ME_INSECURE',
    });
    if (!secret) {
      this.logger.warn(
        'JWT_SECRET not set. Using insecure default for development.',
      );
    }
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      roles: payload.roles || (payload.role ? [payload.role] : []),
      permissions: payload.permissions || [],
    };
  }
}
