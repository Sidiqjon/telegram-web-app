import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber: string;

  @ApiProperty({ example: 'ali_dev' })
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers, and underscores',
  })
  username: string;

  @ApiProperty({ example: 'Ali Karimov' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  fullName: string;

  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password: string;
}
