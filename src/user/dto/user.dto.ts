import { IsString } from 'class-validator';
import { UserRole } from '../type/user-role.type';

export class UserDto {
  @IsString()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  role: UserRole;

  @IsString()
  roleDepartement: string;
}
