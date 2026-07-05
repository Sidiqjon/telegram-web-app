import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { SocketAuthService } from './socket-auth.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [JwtModule.register({}), ConversationsModule, MessagesModule],
  providers: [ChatGateway, SocketAuthService],
})
export class GatewayModule {}
