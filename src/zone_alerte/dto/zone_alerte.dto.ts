import { IsBoolean, IsNumber, IsObject, IsString } from 'class-validator';
import { DepartementDto } from '../../departement/dto/departement.dto';

export class ZoneAlerteDto {
  @IsNumber()
  id: number;

  @IsString()
  code: string;

  @IsString()
  type: string;

  @IsString()
  nom: string;

  @IsNumber()
  numeroVersion: number;

  @IsBoolean()
  disabled: boolean;

  @IsObject()
  departement: DepartementDto;
}
