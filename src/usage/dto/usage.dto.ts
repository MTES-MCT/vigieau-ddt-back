import { IsBoolean, IsNumber, IsObject, IsString } from 'class-validator';
import { ThematiqueDto } from '../../core/dto/thematique.dto';

export class UsageDto {
  @IsNumber()
  id: number;

  @IsString()
  nom: string;

  @IsObject()
  thematique: ThematiqueDto;

  @IsBoolean()
  isTemplate: boolean;

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
