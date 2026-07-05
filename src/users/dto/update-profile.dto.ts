import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ali Karimov' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  fullName?: string;

  @ApiPropertyOptional({ example: 'ali_dev2' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers, and underscores',
  })
  username?: string;

  @ApiPropertyOptional({ example: 'Frontend dev building cool stuff' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;
}
