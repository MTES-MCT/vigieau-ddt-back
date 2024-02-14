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
import { CreateUpdateRestrictionDto } from '../../restriction/dto/create_update_restriction.dto';

class updateDepartementDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;
}

export class ArUpdateArreteCadreDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;
}

export class CreateUpdateArreteRestrictionDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'AC_0', description: "Numéro de l'arrêté cadre" })
  numero: string;

  @IsObject()
  @ValidateNested()
  @Type(() => updateDepartementDto)
  @ApiProperty({ type: updateDepartementDto })
  departement: updateDepartementDto;

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
  @Type(() => ArUpdateArreteCadreDto)
  @ApiProperty({ type: [ArUpdateArreteCadreDto] })
  arretesCadre: ArUpdateArreteCadreDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateUpdateRestrictionDto)
  @ApiProperty({ type: [CreateUpdateRestrictionDto] })
  restrictions: CreateUpdateRestrictionDto[];
}
