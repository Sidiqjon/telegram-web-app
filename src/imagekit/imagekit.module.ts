import { Module } from '@nestjs/common';
import { ImageKitProvider } from './imagekit.provider';
import { ImageKitService } from './imagekit.service';

@Module({
  providers: [ImageKitProvider, ImageKitService],
  exports: [ImageKitService],
})
export class ImageKitModule {}
