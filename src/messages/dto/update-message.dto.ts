import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMessageDto {
  @ApiProperty({ example: 'Actually, how about tomorrow?' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text: string;
}
