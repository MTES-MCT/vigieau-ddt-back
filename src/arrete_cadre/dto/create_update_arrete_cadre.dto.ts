import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateUpdateUsageArreteCadreDto } from '../../usage_arrete_cadre/dto/create_update_usage_arrete_cadre.dto';
import { Type } from 'class-transformer';

class updateDepartementDto {
  @IsNumber()
  id: number;
}

class updateZoneAlerteDto {
  @IsNumber()
  id: number;
}

export class CreateUpdateArreteCadreDto {
  @IsString()
  @IsNotEmpty()
  numero: string;

  @IsString()
  @IsOptional()
  dateDebut: string;

  @IsString()
  @IsOptional()
  dateFin: string;

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => updateDepartementDto)
  departements: updateDepartementDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => updateZoneAlerteDto)
  zonesAlerte: updateZoneAlerteDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateUpdateUsageArreteCadreDto)
  usagesArreteCadre: CreateUpdateUsageArreteCadreDto[];
}
