import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RestrictionDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;
}
