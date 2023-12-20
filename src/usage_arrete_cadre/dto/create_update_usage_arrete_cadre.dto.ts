import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class updateUsageDto {
  @IsNumber()
  id: number;
}

export class CreateUpdateUsageArreteCadreDto {
  @IsNumber()
  @IsOptional()
  id: number;

  @IsObject()
  @ValidateNested()
  @Type(() => updateUsageDto)
  usage: updateUsageDto;

  @IsBoolean()
  concerneParticulier: boolean;

  @IsBoolean()
  concerneEntreprise: boolean;

  @IsBoolean()
  concerneCollectivite: boolean;

  @IsBoolean()
  concerneExploitation: boolean;

  @IsString()
  descriptionVigilance: string;

  @IsString()
  descriptionAlerte: string;

  @IsString()
  descriptionAlerteRenforcee: string;

  @IsString()
  descriptionCrise: string;
}
