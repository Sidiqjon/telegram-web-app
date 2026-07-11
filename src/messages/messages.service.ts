import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ImageKitService } from '../imagekit/imagekit.service';
import { ConversationsService } from '../conversations/conversations.service';
import { PaginationDto } from './dto/pagination.dto';

export const MESSAGE_CREATED_EVENT = 'message.created';
export const MESSAGE_UPDATED_EVENT = 'message.updated';
export const MESSAGE_DELETED_EVENT = 'message.deleted';
export const MESSAGE_STATUS_UPDATED_EVENT = 'message.status.updated';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageKit: ImageKitService,
    private readonly conversationsService: ConversationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createTextMessage(senderId: string, conversationId: string, text: string) {
    await this.conversationsService.assertParticipant(conversationId, senderId);

    const message = await this.prisma.message.create({
      data: { conversationId, senderId, text, type: MessageType.TEXT },
      include: { sender: { select: { id: true, username: true, fullName: true, avatarUrl: true } } },
    });

    await this.createStatusEntryForRecipient(conversationId, senderId, message.id);
    await this.touchConversation(conversationId);

    this.eventEmitter.emit(MESSAGE_CREATED_EVENT, message);
    return message;
  }

  async createFileMessage(
    senderId: string,
    conversationId: string,
    type: typeof MessageType.IMAGE | typeof MessageType.FILE,
    file: Express.Multer.File,
  ) {
    await this.conversationsService.assertParticipant(conversationId, senderId);

    const uploaded = await this.imageKit.uploadFile(
      file.buffer,
      type === MessageType.IMAGE ? 'messages/images' : 'messages/files',
      file.originalname,
    );

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        type,
        fileUrl: uploaded.url,
        filePublicId: uploaded.publicId,
      },
      include: { sender: { select: { id: true, username: true, fullName: true, avatarUrl: true } } },
    });

    await this.createStatusEntryForRecipient(conversationId, senderId, message.id);
    await this.touchConversation(conversationId);

    this.eventEmitter.emit(MESSAGE_CREATED_EVENT, message);
    return message;
  }

  async findForConversation(conversationId: string, userId: string, pagination: PaginationDto) {
    await this.conversationsService.assertParticipant(conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: pagination.limit ?? 20,
      ...(pagination.cursor
        ? { skip: 1, cursor: { id: pagination.cursor } }
        : {}),
      include: {
        sender: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
        statuses: true,
      },
    });

    return messages;
  }

  async editMessage(messageId: string, userId: string, text: string) {
    const message = await this.getOwnedMessage(messageId, userId);

    if (message.type !== MessageType.TEXT) {
      throw new ForbiddenException('Only text messages can be edited');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { text, editedAt: new Date() },
    });

    this.eventEmitter.emit(MESSAGE_UPDATED_EVENT, updated);
    return updated;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.getOwnedMessage(messageId, userId);

    // Free up ImageKit storage for image/file messages
    if (message.filePublicId) {
      await this.imageKit.deleteFile(message.filePublicId);
    }

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        text: null,
        fileUrl: null,
        filePublicId: null,
      },
    });

    this.eventEmitter.emit(MESSAGE_DELETED_EVENT, deleted);
    return deleted;
  }

  async updateStatus(messageId: string, userId: string, status: MessageStatus) {
    const entry = await this.prisma.messageStatusEntry.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { status },
      create: { messageId, userId, status },
    });

    this.eventEmitter.emit(MESSAGE_STATUS_UPDATED_EVENT, entry);
    return entry;
  }

  async markConversationRead(conversationId: string, userId: string) {
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    // Mark every undelivered/unread message sent by the OTHER participant as READ
    const unread = await this.prisma.message.findMany({
      where: { conversationId, senderId: { not: userId } },
      select: { id: true },
    });

    await this.prisma.$transaction(
      unread.map((m: { id: string }) =>
        this.prisma.messageStatusEntry.upsert({
          where: { messageId_userId: { messageId: m.id, userId } },
          update: { status: MessageStatus.READ },
          create: { messageId: m.id, userId, status: MessageStatus.READ },
        }),
      ),
    );

    return { message: 'Conversation marked as read' };
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async getOwnedMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) {
      throw new NotFoundException('Message not found');
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only modify your own messages');
    }
    return message;
  }

  private async createStatusEntryForRecipient(
    conversationId: string,
    senderId: string,
    messageId: string,
  ) {
    const recipientId = await this.conversationsService.getOtherParticipantId(
      conversationId,
      senderId,
    );
    if (!recipientId) return;

    await this.prisma.messageStatusEntry.create({
      data: { messageId, userId: recipientId, status: MessageStatus.SENT },
    });
  }

  private async touchConversation(conversationId: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
}
