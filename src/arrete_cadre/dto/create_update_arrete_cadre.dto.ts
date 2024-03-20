import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateUpdateUsageDto } from '../../usage/dto/create_usage.dto';

class UpdateLinkNestedObjectDto {
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

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateLinkNestedObjectDto)
  @ApiProperty({ type: [UpdateLinkNestedObjectDto] })
  departements: UpdateLinkNestedObjectDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => UpdateLinkNestedObjectDto)
  @ApiProperty({ type: [UpdateLinkNestedObjectDto] })
  zonesAlerte: UpdateLinkNestedObjectDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateUpdateUsageDto)
  @ApiProperty({ type: [CreateUpdateUsageDto] })
  usages: CreateUpdateUsageDto[];

  @IsObject()
  @ValidateNested()
  @IsOptional()
  @Type(() => UpdateLinkNestedObjectDto)
  @ApiProperty({ type: UpdateLinkNestedObjectDto })
  arreteCadreAbroge: UpdateLinkNestedObjectDto;
}
