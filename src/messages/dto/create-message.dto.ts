import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  conversationId: string;

  @ApiProperty({ example: 'Hey, how are you?' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text: string;
}
