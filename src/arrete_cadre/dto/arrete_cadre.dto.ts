import { IsArray, IsBoolean, IsIn, IsNumber, IsString } from 'class-validator';
import { DepartementDto } from '../../departement/dto/departement.dto';
import { ZoneAlerteDto } from '../../zone_alerte/dto/zone_alerte.dto';
import { UsageArreteCadreDto } from '../../usage_arrete_cadre/dto/usage_arrete_cadre.dto';
import { ArreteRestrictionDto } from '../../arrete_restriction/dto/arrete_restriction.dto';
import { FilterOperator, PaginateConfig } from 'nestjs-paginate';
import { ArreteCadre } from '../entities/arrete_cadre.entity';
import { ApiProperty } from '@nestjs/swagger';

export class ArreteCadreDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;

  @IsString()
  @ApiProperty({ example: 'AC_0', description: "Numéro de l'arrêté cadre" })
  numero: string;

  @IsString()
  @ApiProperty({
    example: '01/01/2024',
    description: "Date de début de validité de l'arrêté cadre",
  })
  dateDebut: string;

  @IsString()
  @ApiProperty({
    example: '31/12/2024',
    description: "Date de fin de validité de l'arrêté cadre",
  })
  dateFin: string;

  @IsString()
  @IsIn(['all', 'aep', 'none'])
  @ApiProperty({
    example: 'eap',
    description:
      'Si une commune est touchée par plusieurs zones de même type, faut-il uniformiser au niveau de gravité maximal ?',
  })
  communeNiveauGraviteMax: 'all' | 'aep' | 'none';

  @IsBoolean()
  @ApiProperty({
    example: false,
    description:
      "Des niveaux de gravité spécifiques vont-ils être définis pour l'AEP ?",
  })
  niveauGraviteSpecifiqueEap: boolean;

  @IsString()
  @IsIn(['esu', 'eso', 'max'])
  @ApiProperty({
    example: 'max',
    description:
      "Si niveau niveauGraviteSpecifiqueEap = false, quelle ressource sera utilisée pour communiquer sur l'AEP ?",
  })
  ressourceEapCommunique: 'esu' | 'eso' | 'max';

  @IsArray()
  @ApiProperty({ type: [DepartementDto] })
  departements: DepartementDto[];

  @IsArray()
  @ApiProperty({ type: [ZoneAlerteDto] })
  zonesAlerte: ZoneAlerteDto[];

  @IsArray()
  @ApiProperty({ type: [UsageArreteCadreDto] })
  usagesArreteCadre: UsageArreteCadreDto[];

  @IsArray()
  @ApiProperty({ type: [ArreteRestrictionDto] })
  arretesRestriction: ArreteRestrictionDto[];
}

export const arreteCadrePaginateConfig: PaginateConfig<ArreteCadre> = {
  select: [
    'id',
    'numero',
    'dateDebut',
    'dateFin',
    'statut',
    'arretesRestriction.id',
    'arretesRestriction.numero',
    'arretesRestriction.statut',
    'zonesAlerte.id',
    'zonesAlerte.disabled',
  ],
  sortableColumns: ['dateDebut'],
  defaultSortBy: [['dateDebut', 'DESC']],
  nullSort: 'first',
  relations: [
    'zonesAlerte',
    'departements',
    'arretesRestriction',
    'departementPilote',
  ],
  searchableColumns: ['numero', 'departements.nom', 'departements.code'],
  filterableColumns: {
    statut: [FilterOperator.IN],
    'departements.id': [FilterOperator.EQ],
  },
};
