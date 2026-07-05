import { Inject, Injectable } from '@nestjs/common';
import ImageKit from 'imagekit';
import { v4 as uuidv4 } from 'uuid';
import { IMAGEKIT } from './imagekit.provider';

// Kept as `publicId` (not renamed to `fileId`) on purpose: callers already
// destructure `uploaded.publicId` and store it straight into the existing
// `avatarPublicId` / `filePublicId` Prisma columns. Under the hood this now
// holds ImageKit's `fileId`, but the interface shape is unchanged.
export interface ImageKitUploadResult {
  url: string;
  publicId: string;
}

@Injectable()
export class ImageKitService {
  constructor(@Inject(IMAGEKIT) private readonly imagekit: ImageKit) {}

  /**
   * Uploads a buffer (from Multer memory storage) to ImageKit.
   * `folder` keeps assets organized, e.g. "avatars" or "messages/images".
   * Same signature as the previous Cloudinary-based method.
   */
  async uploadFile(buffer: Buffer, folder: string): Promise<ImageKitUploadResult> {
    const result = await this.imagekit.upload({
      file: buffer,
      fileName: `${uuidv4()}`,
      folder: `/${folder}`,
      useUniqueFileName: true,
    });
    return { url: result.url, publicId: result.fileId };
  }

  async deleteFile(publicId: string): Promise<void> {
    if (!publicId) return;
    await this.imagekit.deleteFile(publicId);
  }
}
