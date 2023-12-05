import { IsNumber, IsString } from 'class-validator';

export class ArreteCadreDto {
  @IsNumber()
  id: number;

  @IsString()
  numero: string;

  @IsString()
  statut: string;
}
