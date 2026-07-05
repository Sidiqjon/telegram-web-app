import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SearchUserDto {
  @ApiProperty({ example: 'ali' })
  @IsString()
  @MinLength(1)
  username: string;
}
