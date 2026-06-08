import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

type RequestLike = {
  body?: unknown;
  ip?: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
  originalUrl?: string;
};

@Injectable()
export class MpesaWebhookGuard implements CanActivate {
  private readonly logger = new Logger(MpesaWebhookGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const url = request.originalUrl || '';
    const ip = this.extractIp(request);

    this.enforceIpAllowlist(ip, url);
    this.validatePayloadShape(url, request.body);

    return true;
  }

  private enforceIpAllowlist(ip: string, url: string): void {
    const configuredAllowlist = (process.env.MPESA_IP_WHITELIST || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const defaultDevAllowed = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    const allowedIps = configuredAllowlist.length ? configuredAllowlist : defaultDevAllowed;

    if (isProd && configuredAllowlist.length === 0) {
      throw new ServiceUnavailableException(
        'M-Pesa webhook allowlist is not configured. Set MPESA_IP_WHITELIST.',
      );
    }

    const normalized = this.normalizeIp(ip);
    const isAllowed = allowedIps.some((allowed) => this.normalizeIp(allowed) === normalized);
    if (!isAllowed) {
      this.logger.warn(`Blocked M-Pesa webhook from ip=${normalized} url=${url}`);
      throw new UnauthorizedException('Webhook source IP is not allowed');
    }
  }

  private validatePayloadShape(url: string, payload: unknown): void {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Webhook payload must be a JSON object');
    }

    const body = payload as Record<string, any>;
    const isStkWebhook = url.includes('/payments/mpesa/webhook') || url.includes('/mpesa/callback');
    const isB2CResult =
      url.includes('/payments/mpesa/b2c-result') || url.includes('/mpesa/result');
    const isB2CTimeout =
      url.includes('/payments/mpesa/b2c-timeout') || url.includes('/mpesa/timeout');

    if (isStkWebhook) {
      const callback = body.Body?.stkCallback;
      const hasCheckoutId = typeof callback?.CheckoutRequestID === 'string';
      const hasResultCode = callback?.ResultCode !== undefined;
      if (!callback || !hasCheckoutId || !hasResultCode) {
        throw new BadRequestException('Invalid STK callback payload');
      }
      return;
    }

    if (isB2CResult) {
      const hasConversation =
        typeof body.ConversationID === 'string' ||
        typeof body.OriginatorConversationID === 'string' ||
        typeof body.Result?.ConversationID === 'string' ||
        typeof body.Result?.OriginatorConversationID === 'string';
      const hasResultCode = body.Result?.ResultCode !== undefined || body.ResultCode !== undefined;
      if (!hasConversation || !hasResultCode) {
        throw new BadRequestException('Invalid B2C result payload');
      }
      return;
    }

    if (isB2CTimeout) {
      const hasConversation =
        typeof body.ConversationID === 'string' ||
        typeof body.OriginatorConversationID === 'string';
      if (!hasConversation) {
        throw new BadRequestException('Invalid B2C timeout payload');
      }
    }
  }

  private extractIp(request: RequestLike): string {
    const rawForwarded = request.headers?.['x-forwarded-for'];
    const forwarded =
      typeof rawForwarded === 'string'
        ? rawForwarded
        : Array.isArray(rawForwarded)
          ? rawForwarded[0]
          : '';

    return (
      forwarded.split(',')[0]?.trim() ||
      request.ip ||
      request.socket?.remoteAddress ||
      ''
    );
  }

  private normalizeIp(ip: string): string {
    return ip.replace(/^::ffff:/, '');
  }
}
