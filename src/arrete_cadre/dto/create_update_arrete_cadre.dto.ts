import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateUpdateUsageArreteCadreDto } from '../../usage_arrete_cadre/dto/create_update_usage_arrete_cadre.dto';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class updateDepartementDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;
}

class updateZoneAlerteDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;
}

export class CreateUpdateArreteCadreDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'AC_0', description: "Numéro de l'arrêté cadre" })
  numero: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: '01/01/2024',
    description: "Date de début de validité de l'arrêté cadre",
  })
  dateDebut: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    example: '31/12/2024',
    description: "Date de fin de validité de l'arrêté cadre",
  })
  dateFin: string;

  @IsString()
  @IsOptional()
  @IsIn(['all', 'aep', 'none'])
  @ApiProperty({
    example: 'eap',
    description:
      'Si une commune est touchée par plusieurs zones de même type, faut-il uniformiser au niveau de gravité maximal ?',
  })
  communeNiveauGraviteMax: 'all' | 'aep' | 'none';

  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    example: false,
    description:
      "Des niveaux de gravité spécifiques vont-ils être définis pour l'AEP ?",
  })
  niveauGraviteSpecifiqueEap: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['esu', 'eso', 'max'])
  @ApiProperty({
    example: 'max',
    description:
      "Si niveau niveauGraviteSpecifiqueEap = false, quelle ressource sera utilisée pour communiquer sur l'AEP ?",
  })
  ressourceEapCommunique: 'esu' | 'eso' | 'max';

  @IsString()
  @IsOptional()
  @IsIn(['esu', 'eso', 'aep', 'max'])
  @ApiProperty({
    example: 'eap',
    description:
      'Quelle ressource afficher en priorité pour les particuliers sur VigiEau ?',
  })
  affichageRessourceParticulier: 'esu' | 'eso' | 'aep' | 'max';

  @IsString()
  @IsOptional()
  @IsIn(['esu', 'eso', 'aep', 'max'])
  @ApiProperty({
    example: 'max',
    description:
      'Quelle ressource afficher en priorité pour les collectivités sur VigiEau ?',
  })
  affichageRessourceCollectivite: 'esu' | 'eso' | 'aep' | 'max';

  @IsString()
  @IsOptional()
  @IsIn(['esu', 'eso', 'aep', 'max'])
  @ApiProperty({
    example: 'max',
    description:
      'Quelle ressource afficher en priorité pour les entreprises sur VigiEau ?',
  })
  affichageRessourceEntreprise: 'esu' | 'eso' | 'aep' | 'max';

  @IsString()
  @IsOptional()
  @IsIn(['esu', 'eso', 'aep', 'max'])
  @ApiProperty({
    example: 'eso',
    description:
      'Quelle ressource afficher en priorité pour les exploitations agricoles sur VigiEau ?',
  })
  affichageRessourceExploitation: 'esu' | 'eso' | 'aep' | 'max';

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => updateDepartementDto)
  @ApiProperty({ type: [updateDepartementDto] })
  departements: updateDepartementDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => updateZoneAlerteDto)
  @ApiProperty({ type: [updateZoneAlerteDto] })
  zonesAlerte: updateZoneAlerteDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateUpdateUsageArreteCadreDto)
  @ApiProperty({ type: [CreateUpdateUsageArreteCadreDto] })
  usagesArreteCadre: CreateUpdateUsageArreteCadreDto[];
}
