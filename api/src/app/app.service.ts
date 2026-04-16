import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getData(): { message: string; status: 'ok' } {
    return { message: 'Hello API', status: 'ok' };
  }
}
