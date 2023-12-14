import { IsArray, IsNumber, IsString } from 'class-validator';
import { ZoneAlerteDto } from '../../zone_alerte/dto/zone_alerte.dto';

export class DepartementDto {
  @IsNumber()
  id: number;

  @IsString()
  code: string;

  @IsString()
  nom: string;

  @IsArray()
  zonesAlerte: ZoneAlerteDto[];
}
