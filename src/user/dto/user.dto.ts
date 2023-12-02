import { IsString } from 'class-validator';
import { UserRole } from '../enum/user-role.enum';

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
