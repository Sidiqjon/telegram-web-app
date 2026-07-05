import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { MessageStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SocketAuthService } from './socket-auth.service';
import { ConversationsService } from '../conversations/conversations.service';
import {
  MessagesService,
  MESSAGE_CREATED_EVENT,
  MESSAGE_DELETED_EVENT,
  MESSAGE_STATUS_UPDATED_EVENT,
  MESSAGE_UPDATED_EVENT,
} from '../messages/messages.service';

const conversationRoom = (conversationId: string) => `conversation:${conversationId}`;
const userRoom = (userId: string) => `user:${userId}`;

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? '*', credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Tracks how many active sockets each user has open (supports multiple tabs/devices)
  private readonly onlineSockets = new Map<string, Set<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly socketAuth: SocketAuthService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const userId = await this.socketAuth.authenticate(socket);
      socket.data.userId = userId;

      socket.join(userRoom(userId));
      this.addOnlineSocket(userId, socket.id);

      await this.prisma.user.update({ where: { id: userId }, data: { isOnline: true } });
      await this.broadcastPresence(userId, true);

      this.logger.log(`Socket connected: user=${userId} socket=${socket.id}`);
    } catch (error) {
      this.logger.warn(`Rejected socket connection: ${(error as Error).message}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const stillOnline = this.removeOnlineSocket(userId, socket.id);
    if (stillOnline) return; // user has other active sockets/tabs — stay "online"

    const lastSeen = new Date();
    await this.prisma.user.update({ where: { id: userId }, data: { isOnline: false, lastSeen } });
    await this.broadcastPresence(userId, false, lastSeen);

    this.logger.log(`Socket disconnected: user=${userId} socket=${socket.id}`);
  }

  @SubscribeMessage('joinConversation')
  async onJoinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = socket.data.userId as string;
    await this.conversationsService.assertParticipant(data.conversationId, userId);
    socket.join(conversationRoom(data.conversationId));
  }

  @SubscribeMessage('leaveConversation')
  onLeaveConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    socket.leave(conversationRoom(data.conversationId));
  }

  @SubscribeMessage('typing')
  async onTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = socket.data.userId as string;
    socket.to(conversationRoom(data.conversationId)).emit('typing', {
      conversationId: data.conversationId,
      userId,
    });
  }

  @SubscribeMessage('stopTyping')
  async onStopTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = socket.data.userId as string;
    socket.to(conversationRoom(data.conversationId)).emit('stopTyping', {
      conversationId: data.conversationId,
      userId,
    });
  }

  /** Text messages sent over the socket (image/file messages go through the REST upload endpoint). */
  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { conversationId: string; text: string },
  ) {
    const userId = socket.data.userId as string;
    // createTextMessage persists the message AND emits MESSAGE_CREATED_EVENT,
    // which handleMessageCreated (below) picks up to broadcast to the room.
    await this.messagesService.createTextMessage(userId, data.conversationId, data.text);
  }

  @SubscribeMessage('messageDelivered')
  async onMessageDelivered(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = socket.data.userId as string;
    await this.messagesService.updateStatus(data.messageId, userId, MessageStatus.DELIVERED);
  }

  @SubscribeMessage('messageRead')
  async onMessageRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = socket.data.userId as string;
    await this.messagesService.updateStatus(data.messageId, userId, MessageStatus.READ);
  }

  // ------------------------------------------------------------
  // Event listeners — bridge REST/Socket message mutations to realtime broadcasts
  // ------------------------------------------------------------

  @OnEvent(MESSAGE_CREATED_EVENT)
  handleMessageCreated(message: any) {
    this.server.to(conversationRoom(message.conversationId)).emit('newMessage', message);
    // Also notify the sender's personal room (covers multi-tab/device sync).
    this.server.to(userRoom(message.senderId)).emit('newMessage', message);
  }

  @OnEvent(MESSAGE_UPDATED_EVENT)
  handleMessageUpdated(message: any) {
    this.server.to(conversationRoom(message.conversationId)).emit('messageUpdated', message);
  }

  @OnEvent(MESSAGE_DELETED_EVENT)
  handleMessageDeleted(message: any) {
    this.server.to(conversationRoom(message.conversationId)).emit('messageDeleted', message);
  }

  @OnEvent(MESSAGE_STATUS_UPDATED_EVENT)
  handleMessageStatusUpdated(entry: any) {
    // Broadcast globally is simplest here — the entry doesn't carry conversationId,
    // and only the relevant sender's client will act on the messageId it recognizes.
    this.server.emit('messageStatusUpdate', entry);
  }

  // ------------------------------------------------------------
  // Presence helpers
  // ------------------------------------------------------------

  private addOnlineSocket(userId: string, socketId: string) {
    const set = this.onlineSockets.get(userId) ?? new Set<string>();
    set.add(socketId);
    this.onlineSockets.set(userId, set);
  }

  /** Returns true if the user still has other open sockets after removing this one. */
  private removeOnlineSocket(userId: string, socketId: string): boolean {
    const set = this.onlineSockets.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.onlineSockets.delete(userId);
      return false;
    }
    return true;
  }

  private async broadcastPresence(userId: string, isOnline: boolean, lastSeen?: Date) {
    // Broadcast to everyone the user shares a conversation with
    const conversations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    const partnerIds = await Promise.all(
      conversations.map((c: any) =>
        this.conversationsService.getOtherParticipantId(c.conversationId, userId),
      ),
    );

    for (const partnerId of partnerIds) {
      if (!partnerId) continue;
      this.server.to(userRoom(partnerId)).emit('userStatus', { userId, isOnline, lastSeen });
    }
  }
}
