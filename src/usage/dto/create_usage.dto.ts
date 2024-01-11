import { IsBoolean, IsObject, IsString } from 'class-validator';
import { ThematiqueDto } from '../../thematique/dto/thematique.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUsageDto {
  @IsString()
  @ApiProperty({
    example: 'Arrosage des plantes',
    description: "Nom de l'usage",
  })
  nom: string;

  @IsObject()
  @ApiProperty({ type: ThematiqueDto })
  thematique: ThematiqueDto;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description: 'Modèle - Est-ce que cet usage concerne les particuliers ?',
  })
  concerneParticulier: boolean;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description: 'Modèle - Est-ce que cet usage concerne les entreprises ?',
  })
  concerneEntreprise: boolean;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description: 'Modèle - Est-ce que cet usage concerne les collectivités ?',
  })
  concerneCollectivite: boolean;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description:
      'Modèle - Est-ce que cet usage concerne les exploitations agricoles ?',
  })
  concerneExploitation: boolean;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description:
      'Modèle - Est-ce que cet usage concerne les eaux souterraines ?',
  })
  concerneEso: boolean;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description:
      'Modèle - Est-ce que cet usage concerne les eaux superficielles ?',
  })
  concerneEsu: boolean;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description: "Modèle - Est-ce que cet usage concerne l'eau potableZ ?",
  })
  concerneAep: boolean;
}
