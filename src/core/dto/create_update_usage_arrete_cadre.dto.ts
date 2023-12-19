import { IsBoolean, IsObject, IsString } from 'class-validator';

export class CreateUpdateUsageArreteCadreDto {
  @IsObject()
  usage: { id: number };

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
