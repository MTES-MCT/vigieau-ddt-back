import { IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FilterOperator, PaginateConfig } from 'nestjs-paginate';
import { ArreteRestriction } from '../entities/arrete_restriction.entity';

export class ArreteRestrictionDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;

  @IsString()
  @ApiProperty({
    example: 'AR_0',
    description: "Numéro de l'arrêté de restriction",
  })
  numero: string;

  @IsString()
  @ApiProperty({
    example: '01/01/2024',
    description: "Date de début de validité de l'arrêté de restriction",
  })
  dateDebut: string;

  @IsString()
  @ApiProperty({
    example: '31/12/2024',
    description: "Date de fin de validité de l'arrêté de restriction",
  })
  dateFin: string;

  @IsString()
  @ApiProperty({
    example: '25/12/2023',
    description: "Date de signature de l'arrêté de restriction",
  })
  dateSignature: string;
}

export const arreteRestrictionPaginateConfig: PaginateConfig<ArreteRestriction> =
  {
    select: ['id', 'numero', 'statut', 'dateDebut', 'dateFin', 'dateSignature'],
    sortableColumns: ['dateDebut'],
    defaultSortBy: [['dateDebut', 'DESC']],
    nullSort: 'last',
    relations: ['arretesCadre', 'arretesCadre.departements'],
    searchableColumns: [
      'numero',
      'arretesCadre.numero',
      'arretesCadre.departements.nom',
      'arretesCadre.departements.code',
    ],
    filterableColumns: {
      statut: [FilterOperator.IN],
    },
  };
