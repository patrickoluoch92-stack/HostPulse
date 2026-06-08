import { config } from 'dotenv';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app/app.module';
import { AllExceptionsFilter } from './app/http-exception.filter';
import { JsonLoggerService } from './common/logging/json-logger.service';
import { AppConfigService } from './config/app-config.service';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '..', '.env') });

async function bootstrap() {
  AppConfigService.validateEnvironment();

  const logger = new JsonLoggerService();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger,
  });
  const configService = app.get(AppConfigService);
  const globalPrefix = 'api';
  const httpAdapter = app.getHttpAdapter().getInstance();

  app.useLogger(logger);
  app.enableShutdownHooks();
  app.setGlobalPrefix(globalPrefix, { exclude: ['health'] });
  httpAdapter.set('trust proxy', 1);

  app.useGlobalFilters(new AllExceptionsFilter(logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.use((req: Request & { requestId?: string }, res: Response, next: NextFunction) => {
    const requestId = req.header('x-request-id') || randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.logRequest({
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        ip: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });
    });

    next();
  });

  const shouldSkipGlobalRateLimit = (path: string) =>
    path === '/health' ||
    path.includes('/api/payments/mpesa/webhook') ||
    path.includes('/api/payments/mpesa/b2c-result') ||
    path.includes('/api/payments/mpesa/b2c-timeout') ||
    path.includes('/api/mpesa/callback') ||
    path.includes('/api/mpesa/result') ||
    path.includes('/api/mpesa/timeout');

  app.use(
    rateLimit({
      windowMs: configService.rateLimitWindowMs,
      limit: configService.rateLimitMax,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => shouldSkipGlobalRateLimit(req.originalUrl || req.url),
      handler: (_req, res) => {
        res.status(429).json({
          statusCode: 429,
          message: 'Too many requests. Please try again later.',
          error: 'Too Many Requests',
          timestamp: new Date().toISOString(),
        });
      },
    }),
  );

  app.use(
    '/api/auth',
    rateLimit({
      windowMs: configService.rateLimitWindowMs,
      limit: configService.authRateLimitMax,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  app.enableCors({
    origin: configService.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
  });

  const preferredPort = configService.port;
  const host = configService.host;

  configService.logNonBlockingWarnings();
  const actualPort = await listenOnAvailablePort(
    app,
    preferredPort,
    host,
    configService,
    logger,
  );

  logger.log(`Application is running on http://localhost:${actualPort}/${globalPrefix}`, 'Bootstrap');
  if (actualPort !== preferredPort) {
    logger.warn(
      `Preferred port ${preferredPort} was unavailable. HostPulse started on fallback port ${actualPort}.`,
      'Bootstrap',
    );
  }
  if (host === '0.0.0.0') {
    logger.log('Application is accepting connections on all interfaces', 'Bootstrap');
  }
}

bootstrap();

async function listenOnAvailablePort(
  app: Awaited<ReturnType<typeof NestFactory.create>>,
  preferredPort: number,
  host: string,
  configService: AppConfigService,
  logger: JsonLoggerService,
): Promise<number> {
  const maxAttempts = Math.max(0, configService.portFallbackAttempts);

  for (let offset = 0; offset <= maxAttempts; offset += 1) {
    const candidatePort = preferredPort + offset;

    try {
      await app.listen(candidatePort, host);
      return candidatePort;
    } catch (error: any) {
      if (error?.code !== 'EADDRINUSE') {
        throw error;
      }

      const canFallback =
        configService.shouldAutoFallbackPort && offset < maxAttempts;
      if (!canFallback) {
        logger.error(
          `Port ${candidatePort} is already in use. Set PORT to a free value or enable PORT_AUTO_FALLBACK for automatic recovery.`,
          error?.stack,
          'Bootstrap',
        );
        process.exit(1);
      }

      logger.warn(
        `Port ${candidatePort} is already in use. Trying ${candidatePort + 1}...`,
        'Bootstrap',
      );
    }
  }

  throw new Error('No available port found for the API server.');
}
