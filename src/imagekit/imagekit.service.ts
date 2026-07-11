import { Inject, Injectable } from '@nestjs/common';
import ImageKit from 'imagekit';
import { v4 as uuidv4 } from 'uuid';
import { IMAGEKIT } from './imagekit.provider';

export interface ImageKitUploadResult {
  url: string;
  publicId: string;
}

@Injectable()
export class ImageKitService {
  constructor(@Inject(IMAGEKIT) private readonly imagekit: ImageKit) {}

  async uploadFile(
    buffer: Buffer,
    folder: string,
    originalFileName?: string,
  ): Promise<ImageKitUploadResult> {
    const extension = originalFileName?.includes('.')
      ? originalFileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
      : undefined;
    const fileName = extension ? `${uuidv4()}.${extension}` : uuidv4();

    const result = await this.imagekit.upload({
      file: buffer,
      fileName,
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