import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JsonLoggerService } from '../common/logging/json-logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responsePayload =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const body =
      typeof responsePayload === 'object' && responsePayload !== null && 'message' in responsePayload
        ? (responsePayload as { message: string | string[]; error?: string })
        : { message: 'Internal server error' };
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;

    const isDev = process.env.NODE_ENV !== 'production';
    const actualError =
      exception instanceof Error ? exception.message : String(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${actualError}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const safeMessage =
      status >= 500
        ? isDev
          ? actualError
          : 'Something went wrong. Please try again.'
        : msg;

    const statusLabel =
      body.error ||
      HttpStatus[status]
        ?.toString()
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()) ||
      'Error';

    response.status(status).json({
      statusCode: status,
      message: safeMessage,
      error: statusLabel,
      path: request.url,
      method: request.method,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
