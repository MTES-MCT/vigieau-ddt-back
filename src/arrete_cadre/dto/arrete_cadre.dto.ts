import { IsArray, IsNumber, IsString } from 'class-validator';
import { DepartementDto } from '../../departement/dto/departement.dto';
import { ZoneAlerteDto } from '../../zone_alerte/dto/zone_alerte.dto';

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
  departements: DepartementDto[];

  @IsArray()
  zonesAlerte: ZoneAlerteDto[];
}
