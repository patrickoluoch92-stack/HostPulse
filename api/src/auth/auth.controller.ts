import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

// Renamed to avoid collision with app/auth
@Controller('legacy-auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string; phone?: string }) {
    return this.authService.register(body.email, body.password, body.phone);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }
}
