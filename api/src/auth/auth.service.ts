import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, phone?: string) {
    const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const passwordStr = typeof password === 'string' ? password : '';
    if (!emailStr || !passwordStr) throw new BadRequestException('Email and password are required');
    if (passwordStr.length < 6) throw new BadRequestException('Password must be at least 6 characters');

    const existingUser = await this.prisma.user.findUnique({ where: { email: emailStr } });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(passwordStr, 10);

    const user = await this.prisma.user.create({
      data: {
        email: emailStr,
        hashedPassword,
        phone: phone || null,
        role: 'guest',
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
