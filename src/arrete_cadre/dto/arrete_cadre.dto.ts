import { IsArray, IsNumber, IsString } from 'class-validator';

export class ArreteCadreDto {
  @IsNumber()
  id: number;

  @IsString()
  numero: string;

  @IsString()
  dateDebut: string;

  @IsString()
  dateFin: string;

  @IsArray()
  departements: any[];
}
