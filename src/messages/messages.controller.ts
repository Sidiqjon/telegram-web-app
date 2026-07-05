import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateFileMessageDto } from './dto/create-file-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { PaginationDto } from './dto/pagination.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiBearerAuth()
@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  createText(@CurrentUser('id') userId: string, @Body() dto: CreateMessageDto) {
    return this.messagesService.createTextMessage(userId, dto.conversationId, dto.text);
  }

  @ApiConsumes('multipart/form-data')
  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  createFile(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateFileMessageDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.messagesService.createFileMessage(userId, dto.conversationId, dto.type, file);
  }

  @Get('conversation/:conversationId')
  findForConversation(
    @CurrentUser('id') userId: string,
    @Param('conversationId') conversationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.messagesService.findForConversation(conversationId, userId, pagination);
  }

  @Patch(':id')
  edit(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messagesService.editMessage(id, userId, dto.text);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.messagesService.deleteMessage(id, userId);
  }

  @Patch('conversation/:conversationId/read')
  markRead(@CurrentUser('id') userId: string, @Param('conversationId') conversationId: string) {
    return this.messagesService.markConversationRead(conversationId, userId);
  }
}
