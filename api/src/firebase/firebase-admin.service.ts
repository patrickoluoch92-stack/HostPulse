import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private readonly app: App | null;
  private readonly auth: Auth | null;
  private readonly enabled: boolean;

  constructor() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.enabled = false;
      this.app = null;
      this.auth = null;
      this.logger.warn(
        'Firebase Admin is disabled. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to enable Firebase token verification.',
      );
      return;
    }

    this.enabled = true;
    this.app =
      getApps().length > 0
        ? getApp()
        : initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
            projectId,
          });
    this.auth = getAuth(this.app);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  async verifyIdToken(idToken: string) {
    if (!this.auth) {
      throw new ServiceUnavailableException('Firebase Admin is not configured.');
    }
    return this.auth.verifyIdToken(idToken);
  }
}
