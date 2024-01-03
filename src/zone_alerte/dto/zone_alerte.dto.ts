import { IsBoolean, IsNumber, IsObject, IsString } from 'class-validator';
import { DepartementDto } from '../../departement/dto/departement.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ZoneAlerteDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;

  @IsString()
  @ApiProperty({ example: 'ZA_01', description: "Code de la zone d'alerte" })
  code: string;

  @IsString()
  @ApiProperty({
    example: 'SUP',
    description: "Type de la zone d'alerte",
    enum: ['SUP', 'SOU'],
  })
  type: string;

  @IsString()
  @ApiProperty({
    example: 'Zone superficielle Ain 01',
    description: "Nom de la zone d'alerte",
  })
  nom: string;

  @IsNumber()
  @ApiProperty({
    example: 1,
    description: "Numéro de version de la zone d'alerte",
  })
  numeroVersion: number;

  @IsBoolean()
  @ApiProperty({
    example: false,
    description: "Est-ce que la zone d'alerte est désactivitée ?",
  })
  disabled: boolean;

  @IsObject()
  departement: DepartementDto;
}
