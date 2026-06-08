import { Injectable, LoggerService } from '@nestjs/common';
import { inspect } from 'node:util';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

type RequestLogDetails = {
  durationMs: number;
  ip?: string;
  method: string;
  path: string;
  requestId: string;
  statusCode: number;
  userAgent?: string;
};

@Injectable()
export class JsonLoggerService implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, trace?: string, context?: string): void {
    this.write('fatal', message, context, trace);
  }

  logRequest(details: RequestLogDetails): void {
    this.write('log', `${details.method} ${details.path}`, 'HTTP', undefined, details);
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    trace?: string,
    extra?: Record<string, unknown>,
  ): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: this.serialize(message),
      ...(trace ? { trace } : {}),
      ...(extra ?? {}),
    };

    const line = `${JSON.stringify(entry)}\n`;
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(line);
      return;
    }

    process.stdout.write(line);
  }

  private serialize(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return inspect(message, {
        depth: 4,
        breakLength: 120,
        compact: true,
      });
    }
  }
}
