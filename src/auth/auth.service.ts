import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AccessTokenPayload, RefreshTokenPayload } from './types/jwt-payload.type';

const REFRESH_TOKEN_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phoneNumber: dto.phoneNumber }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException(
        existing.phoneNumber === dto.phoneNumber
          ? 'Phone number is already registered'
          : 'Username is already taken',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        phoneNumber: dto.phoneNumber,
        username: dto.username,
        fullName: dto.fullName,
        password: hashedPassword,
      },
    });

    const tokens = await this.issueTokens(user.id, user.username);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    const tokens = await this.issueTokens(user.id, user.username);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refreshTokens(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    const matches = await bcrypt.compare(refreshToken, stored.tokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    // Rotate: revoke the old token, issue a brand new pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const tokens = await this.issueTokens(user.id, user.username);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async logout(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      await this.prisma.refreshToken.update({
        where: { id: payload.jti },
        data: { revoked: true },
      });
    } catch {
      // Token already invalid/expired — logout is a no-op in that case, not an error
    }
    return { message: 'Logged out successfully' };
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  /** Issues a fresh access + refresh token pair and persists the refresh token hash. */
  private async issueTokens(userId: string, username: string) {
    const jti = uuidv4();

    const accessPayload: AccessTokenPayload = { sub: userId, username };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });

    const refreshPayload: RefreshTokenPayload = { sub: userId, jti };
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    const tokenHash = await bcrypt.hash(refreshToken, REFRESH_TOKEN_SALT_ROUNDS);
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        tokenHash,
        userId,
        expiresAt: this.calculateExpiryDate(refreshExpiresIn),
      },
    });

    return { accessToken, refreshToken };
  }

  private calculateExpiryDate(duration: string): Date {
    const match = duration.match(/^(\d+)([smhd])$/);
    const value = match ? parseInt(match[1], 10) : 7;
    const unit = match ? match[2] : 'd';
    const msPerUnit: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(Date.now() + value * (msPerUnit[unit] ?? msPerUnit.d));
  }

  private sanitizeUser(user: { password: string; [key: string]: any }) {
    const { password, ...safeUser } = user;
    return safeUser;
  }
}
