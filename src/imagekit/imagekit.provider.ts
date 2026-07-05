import { ConfigService } from '@nestjs/config';
import ImageKit from 'imagekit';

export const IMAGEKIT = 'IMAGEKIT';

export const ImageKitProvider = {
  provide: IMAGEKIT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new ImageKit({
      publicKey: config.get<string>('IMAGEKIT_PUBLIC_KEY')!,
      privateKey: config.get<string>('IMAGEKIT_PRIVATE_KEY')!,
      urlEndpoint: config.get<string>('IMAGEKIT_URL_ENDPOINT')!,
    });
  },
};
