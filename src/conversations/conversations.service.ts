import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the existing 1:1 conversation between two users, or creates one.
   * A conversation is uniquely identified by its pair of participants.
   */
  async findOrCreate(userId: string, participantId: string) {
    if (userId === participantId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }

    const otherUser = await this.prisma.user.findUnique({ where: { id: participantId } });
    if (!otherUser) {
      throw new NotFoundException('User not found');
    }

    // Look for a conversation that has exactly these two participants
    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
      include: { participants: { include: { user: true } } },
    });

    if (existing) {
      return this.formatConversation(existing, userId);
    }

    const created = await this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: participantId }],
        },
      },
      include: { participants: { include: { user: true } } },
    });

    return this.formatConversation(created, userId);
  }

  async findAllForUser(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((c: any) => this.formatConversation(c, userId));
  }

  /** Throws if the given user is not a participant of the conversation. Used by Messages & the Gateway. */
  async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }
    return participant;
  }

  async getOtherParticipantId(conversationId: string, userId: string): Promise<string | null> {
    const other = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, NOT: { userId } },
    });
    return other?.userId ?? null;
  }

  /** Shapes the raw Prisma result into a clean payload, hiding the "self" participant row. */
  private formatConversation(conversation: any, currentUserId: string) {
    const otherParticipant = conversation.participants.find(
      (p: any) => p.userId !== currentUserId,
    );
    const { password, ...otherUser } = otherParticipant?.user ?? {};

    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      participant: otherUser,
      lastMessage: conversation.messages?.[0] ?? null,
    };
  }
}
