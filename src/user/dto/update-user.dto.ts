import { IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { UserRole } from '../type/user-role.type';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'departement',
    enum: ['mte', 'departement'],
    description: "Rôle de l'utilisateur",
  })
  role: UserRole;

  @ValidateIf((o) => o.role === 'departement')
  @IsString()
  @IsNotEmpty()
  @Matches(/^([0|2][1-9]|[1|3-8][0-9]|9[0-5]|97[1-4]|2[AB]|976)$/)
  @ApiProperty({
    example: '01',
    description:
      "Département associé à l'utilisateur lorsque son rôle n'est pas MTE",
  })
  roleDepartement: string;
}
