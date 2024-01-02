import { IsNumber, IsString } from 'class-validator';

export class ArreteRestrictionDto {
  @IsNumber()
  id: number;

  @IsString()
  numero: string;

  @IsString()
  dateDebut: string;

  @IsString()
  dateFin: string;

  @IsString()
  dateSignature: string;
}
