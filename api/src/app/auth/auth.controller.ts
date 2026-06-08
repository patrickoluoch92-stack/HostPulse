import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirebaseExchangeDto } from './dto/firebase-exchange.dto';
import { RegisterDto } from '../../auth/dto/register.dto';
import { LoginDto } from '../../auth/dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.phone);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('firebase/exchange')
  async firebaseExchange(
    @Body() dto: FirebaseExchangeDto,
  ) {
    return this.authService.loginWithFirebase(dto.idToken, dto.phone);
  }
}
