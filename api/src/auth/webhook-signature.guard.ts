import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = process.env.MPESA_WEBHOOK_SECRET;

    if (!secret) {
      throw new UnauthorizedException(
        'Webhook secret is not configured. Set MPESA_WEBHOOK_SECRET.',
      );
    }

    const providedSignature =
      request.header('x-webhook-signature') ||
      request.header('x-mpesa-signature') ||
      request.header('x-signature');

    if (!providedSignature) {
      throw new UnauthorizedException('Missing webhook signature header.');
    }

    const rawPayload = JSON.stringify(request.body ?? {});
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawPayload)
      .digest('hex');

    const provided = Buffer.from(providedSignature, 'utf8');
    const computed = Buffer.from(computedSignature, 'utf8');

    if (provided.length !== computed.length) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const isValid = crypto.timingSafeEqual(provided, computed);
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    return true;
  }
}
