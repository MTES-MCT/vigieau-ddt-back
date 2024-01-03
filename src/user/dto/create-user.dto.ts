import { IsNotEmpty, IsString } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto extends UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'test@exemple.com',
    description: "Email de l'utilisateur",
  })
  email: string;
}
