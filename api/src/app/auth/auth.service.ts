import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, phone?: string) {
    const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const passwordStr = typeof password === 'string' ? password : '';
    if (!emailStr || !passwordStr) {
      throw new BadRequestException('Email and password are required');
    }
    if (passwordStr.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const hashedPassword = await bcrypt.hash(passwordStr, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: emailStr,
          hashedPassword,
          phone: phone != null && String(phone).trim() !== '' ? String(phone).trim() : null,
          role: 'guest',
        },
      });

      const { hashedPassword: _, ...userWithoutPassword } = user;
      const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });

      return {
        accessToken,
        user: userWithoutPassword,
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException('Email already registered');
        }
        if (e.code === 'P1001' || e.code === 'P1002') {
          throw new InternalServerErrorException(
            'Database is unreachable. Check DATABASE_URL and that PostgreSQL is running.',
          );
        }
      }
      if (e instanceof Prisma.PrismaClientInitializationError) {
        throw new InternalServerErrorException(
          'Database client failed to initialize. Check DATABASE_URL and connectivity.',
        );
      }
      if (e instanceof Prisma.PrismaClientValidationError) {
        throw new BadRequestException('Invalid registration payload.');
      }
      if (e instanceof Error) {
        throw new InternalServerErrorException(
          `Registration failed due to a server error: ${e.message}`,
        );
      }
      throw e;
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { hashedPassword: _, ...userWithoutPassword } = user;
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }

  async validateUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const { hashedPassword: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
