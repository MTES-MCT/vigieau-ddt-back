import { IsNumber, IsObject, IsString } from 'class-validator';
import { DepartementDto } from '../../core/dto/departement.dto';

export class ZoneAlerteDto {
  @IsNumber()
  id: number;

  @IsString()
  code: string;

  @IsString()
  type: string;

  @IsString()
  nom: string;

  @IsObject()
  departement: DepartementDto;
}
