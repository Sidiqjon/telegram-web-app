import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ description: 'The user id you want to start a private chat with' })
  @IsString()
  @IsUUID()
  participantId: string;
}
