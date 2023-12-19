import { IsBoolean, IsObject, IsString } from 'class-validator';
import { ThematiqueDto } from '../../thematique/dto/thematique.dto';

export class CreateUsageDto {
  @IsString()
  nom: string;

  @IsObject()
  thematique: ThematiqueDto;

  @IsBoolean()
  concerneParticulier: boolean;

  @IsBoolean()
  concerneEntreprise: boolean;

  @IsBoolean()
  concerneCollectivite: boolean;

  @IsBoolean()
  concerneExploitation: boolean;
}
