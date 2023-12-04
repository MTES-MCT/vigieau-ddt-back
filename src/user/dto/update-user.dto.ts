import { IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { UserRole } from '../type/user-role.type';

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  role: UserRole;

  @ValidateIf((o) => o.role === 'departement')
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0|2][1-9]|[1|3-8][0-9]|9[0-5]|97[1-4]|2[AB]|976)$/)
  roleDepartement: string;
}
