import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID } from 'class-validator';
import { MessageType } from '@prisma/client';

export class CreateFileMessageDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  conversationId: string;

  @ApiProperty({ enum: [MessageType.IMAGE, MessageType.FILE] })
  @IsEnum(MessageType)
  type: typeof MessageType.IMAGE | typeof MessageType.FILE;
}
