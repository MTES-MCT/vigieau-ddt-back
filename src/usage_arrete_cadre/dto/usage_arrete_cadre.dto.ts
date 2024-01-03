import { IsBoolean, IsNumber, IsObject, IsString } from 'class-validator';
import { UsageDto } from '../../usage/dto/usage.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ZoneAlerteDto } from '../../zone_alerte/dto/zone_alerte.dto';

export class UsageArreteCadreDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;

  @IsObject()
  @ApiProperty({ type: UsageDto })
  usage: UsageDto;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description: 'Est-ce que cet usage concerne les particuliers ?',
  })
  concerneParticulier: boolean;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description: 'Est-ce que cet usage concerne les entreprises ?',
  })
  concerneEntreprise: boolean;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description: 'Est-ce que cet usage concerne les collectivités ?',
  })
  concerneCollectivite: boolean;

  @IsBoolean()
  @ApiProperty({
    example: true,
    description: 'Est-ce que cet usage concerne les exploitations agricoles ?',
  })
  concerneExploitation: boolean;

  @IsString()
  @ApiProperty({
    example: 'Pas de restrictions',
    description: 'Description des restrictions en situation de vigilance',
  })
  descriptionVigilance: string;

  @IsString()
  @ApiProperty({
    example: 'Pas de restrictions',
    description: "Description des restrictions en situation d'alerte",
  })
  descriptionAlerte: string;

  @IsString()
  @ApiProperty({
    example: 'Interdiction de 8h à 20h',
    description: "Description des restrictions en situation d'alerte renforcée",
  })
  descriptionAlerteRenforcee: string;

  @IsString()
  @ApiProperty({
    example: 'Interdiction totale',
    description: 'Description des restrictions en situation de crise',
  })
  descriptionCrise: string;
}
