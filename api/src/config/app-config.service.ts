import { Injectable, Logger } from '@nestjs/common';

type EnvMap = Record<string, string | undefined>;

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly env: EnvMap = process.env;

  static validateEnvironment(env: EnvMap = process.env): void {
    const errors: string[] = [];
    const isProduction = (env.NODE_ENV || '').toLowerCase() === 'production';

    if (!env.DATABASE_URL) {
      errors.push('DATABASE_URL is required (PostgreSQL connection string).');
    } else if (!env.DATABASE_URL.startsWith('postgresql://')) {
      errors.push('DATABASE_URL must start with "postgresql://".');
    }

    const jwtSecret = env.JWT_ACCESS_SECRET?.trim();
    if (!jwtSecret || jwtSecret.length < 12) {
      errors.push('JWT_ACCESS_SECRET is required and must be at least 12 characters.');
    } else if (isProduction && jwtSecret.length < 32) {
      errors.push('JWT_ACCESS_SECRET must be at least 32 characters in production.');
    }

    if (env.PORT && Number.isNaN(Number(env.PORT))) {
      errors.push('PORT must be a valid number.');
    } else if (env.PORT && Number(env.PORT) <= 0) {
      errors.push('PORT must be greater than 0.');
    }

    if (env.PORT_FALLBACK_ATTEMPTS && Number.isNaN(Number(env.PORT_FALLBACK_ATTEMPTS))) {
      errors.push('PORT_FALLBACK_ATTEMPTS must be a valid number.');
    }

    if (env.RATE_LIMIT_WINDOW_MS && Number.isNaN(Number(env.RATE_LIMIT_WINDOW_MS))) {
      errors.push('RATE_LIMIT_WINDOW_MS must be a valid number.');
    }

    if (env.RATE_LIMIT_MAX && Number.isNaN(Number(env.RATE_LIMIT_MAX))) {
      errors.push('RATE_LIMIT_MAX must be a valid number.');
    }

    if (env.AUTH_RATE_LIMIT_MAX && Number.isNaN(Number(env.AUTH_RATE_LIMIT_MAX))) {
      errors.push('AUTH_RATE_LIMIT_MAX must be a valid number.');
    }

    if (isProduction) {
      const callbackUrl = env.MPESA_CALLBACK_URL?.trim();
      if (callbackUrl && !callbackUrl.startsWith('https://')) {
        errors.push('MPESA_CALLBACK_URL must use HTTPS in production.');
      }

      const apiBaseUrl = env.API_BASE_URL?.trim();
      if (apiBaseUrl && !apiBaseUrl.startsWith('https://')) {
        errors.push('API_BASE_URL must use HTTPS in production.');
      }

      if (!env.MPESA_IP_WHITELIST?.trim()) {
        errors.push('MPESA_IP_WHITELIST is required in production.');
      }
    }

    if (errors.length) {
      throw new Error(`Startup validation failed:\n- ${errors.join('\n- ')}`);
    }
  }

  get nodeEnv(): string {
    return this.env.NODE_ENV || 'development';
  }

  get port(): number {
    return this.parsePositiveInt('PORT', 5000);
  }

  get host(): string {
    return this.env.HOST || '0.0.0.0';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get jwtAccessSecret(): string {
    const value = this.env.JWT_ACCESS_SECRET?.trim();
    if (!value) {
      throw new Error('JWT_ACCESS_SECRET environment variable is required.');
    }
    return value;
  }

  get jwtAccessExpiresIn(): string {
    return this.env.JWT_ACCESS_EXPIRES_IN?.trim() || '1d';
  }

  get rateLimitWindowMs(): number {
    return this.parsePositiveInt('RATE_LIMIT_WINDOW_MS', 60_000);
  }

  get rateLimitMax(): number {
    return this.parsePositiveInt('RATE_LIMIT_MAX', 120);
  }

  get authRateLimitMax(): number {
    return this.parsePositiveInt('AUTH_RATE_LIMIT_MAX', 10);
  }

  get portFallbackAttempts(): number {
    return this.parsePositiveInt('PORT_FALLBACK_ATTEMPTS', 10);
  }

  get shouldAutoFallbackPort(): boolean {
    const rawValue = this.env.PORT_AUTO_FALLBACK;
    if (!rawValue) {
      return !this.isProduction;
    }

    return ['1', 'true', 'yes', 'on'].includes(rawValue.trim().toLowerCase());
  }

  get corsOrigins(): string[] {
    const value = this.env.CORS_ORIGINS;
    if (value && value.trim().length > 0) {
      return value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    }
    return [
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
    ];
  }

  logNonBlockingWarnings(): void {
    if (!this.env.GOOGLE_PLACES_API_KEY) {
      this.logger.warn('GOOGLE_PLACES_API_KEY is missing. Google ingestion endpoints will fail until set.');
    }
    if (!this.env.REDIS_URL) {
      this.logger.warn('REDIS_URL is missing. Background queue jobs are disabled.');
    }
    if (!this.env.MPESA_CALLBACK_URL) {
      this.logger.warn(
        'MPESA_CALLBACK_URL is missing. Defaulting to the local webhook URL; production callbacks will fail until this is set.',
      );
    }
    if (!this.env.CORS_ORIGINS) {
      this.logger.warn('CORS_ORIGINS is not set. Falling back to localhost development origins.');
    }
    if (this.shouldAutoFallbackPort) {
      this.logger.warn(
        `Automatic API port fallback is enabled. Preferred port: ${this.port}, attempts: ${this.portFallbackAttempts}.`,
      );
    }
  }

  private parsePositiveInt(key: string, fallback: number): number {
    const rawValue = this.env[key];
    if (!rawValue) {
      return fallback;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${key} must be a positive number.`);
    }

    return Math.floor(parsed);
  }
}
