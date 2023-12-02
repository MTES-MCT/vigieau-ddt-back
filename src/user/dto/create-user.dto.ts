import { IsNotEmpty, IsString } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

export class CreateUserDto extends UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  email: string;
}
