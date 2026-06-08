import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FirebaseAdminService } from '../../firebase/firebase-admin.service';
import { AppConfigService } from '../../config/app-config.service';
import { AuthService } from './auth.service';

@Injectable()
export class HybridAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly configService: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = String(request.headers?.authorization || '');
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const jwtUser = await this.tryLegacyJwt(token);
    if (jwtUser) {
      request.user = jwtUser;
      return true;
    }

    const firebaseUser = await this.tryFirebaseToken(token);
    if (firebaseUser) {
      request.user = firebaseUser;
      return true;
    }

    throw new UnauthorizedException('Invalid or expired authentication token.');
  }

  private async tryLegacyJwt(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.jwtAccessSecret,
      });
      const userId = Number(payload?.sub);
      if (Number.isNaN(userId)) return null;
      const user = await this.authService.validateUser(userId);
      if (!user) return null;
      return { ...user, userId: user.id, sub: user.id, authProvider: 'jwt' };
    } catch {
      return null;
    }
  }

  private async tryFirebaseToken(token: string) {
    if (!this.firebaseAdminService.isEnabled) return null;

    try {
      const decoded = await this.firebaseAdminService.verifyIdToken(token);
      const user = await this.authService.findOrCreateFromFirebase(decoded);
      return {
        ...user,
        userId: user.id,
        sub: user.id,
        firebaseUid: decoded.uid,
        authProvider: 'firebase',
      };
    } catch {
      return null;
    }
  }
}
