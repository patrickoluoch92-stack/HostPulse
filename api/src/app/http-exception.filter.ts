import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const body =
      typeof message === 'object' && message !== null && 'message' in message
        ? (message as { message: string | string[] })
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

    let safeMessage: string;
    if (status >= 500) {
      safeMessage = isDev ? actualError : 'Something went wrong. Please try again.';
    } else {
      safeMessage = msg;
    }

    response.status(status).json({
      statusCode: status,
      message: safeMessage,
      ...(status >= 400 && status < 500 ? { error: body.message } : {}),
    });
  }
}
