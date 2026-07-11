import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImageKitService } from '../imagekit/imagekit.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageKit: ImageKitService,
  ) {}

  async searchByUsername(query: string, excludeUserId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
        NOT: { id: excludeUserId },
      },
      select: { id: true, fullName: true, username: true, avatarUrl: true },
      take: 20,
    });
    return users;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username is already taken');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        username: dto.username,
        bio: dto.bio,
      },
    });

    return this.sanitize(user);
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Upload the new avatar first
    const uploaded = await this.imageKit.uploadFile(file.buffer, 'avatars', file.originalname);

    // Then remove the previous one, if any, so we don't leak storage
    if (user.avatarPublicId) {
      await this.imageKit.deleteFile(user.avatarPublicId);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: uploaded.url, avatarPublicId: uploaded.publicId },
    });

    return this.sanitize(updated);
  }

  async deleteAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.avatarPublicId) {
      await this.imageKit.deleteFile(user.avatarPublicId);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null, avatarPublicId: null },
    });

    return this.sanitize(updated);
  }

  private sanitize(user: { password: string; [key: string]: any }) {
    const { password, ...safeUser } = user;
    return safeUser;
  }
}
