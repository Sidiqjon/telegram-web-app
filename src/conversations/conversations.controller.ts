import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiBearerAuth()
@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateConversationDto) {
    return this.conversationsService.findOrCreate(userId, dto.participantId);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.conversationsService.findAllForUser(userId);
  }
}
