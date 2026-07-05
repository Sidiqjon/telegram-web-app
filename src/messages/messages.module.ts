import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { ImageKitModule } from '../imagekit/imagekit.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [ImageKitModule, ConversationsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
