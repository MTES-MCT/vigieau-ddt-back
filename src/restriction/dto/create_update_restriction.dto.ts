import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateUpdateUsageArreteRestrictionDto } from '../../usage_arrete_restriction/dto/create_update_usage_arrete_restriction.dto';

class UpdateLinkNestedObjectDto {
  @IsNumber()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;
}

export class CreateUpdateRestrictionDto {
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateLinkNestedObjectDto)
  @ApiProperty({ type: UpdateLinkNestedObjectDto })
  zoneAlerte: UpdateLinkNestedObjectDto;

  @IsString()
  @Matches(/^vigilance$|^alerte$|^alerte_renforcee$|^crise$/)
  @IsOptional()
  @ApiProperty({
    example: 'alerte',
    enum: ['vigilance', 'alerte', 'alerte_renforcee', 'crise'],
    description: "Niveau de gravité associée à la zone d'alerte",
  })
  niveauGravite: 'vigilance' | 'alerte' | 'alerte_renforcee' | 'crise';

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => CreateUpdateUsageArreteRestrictionDto)
  @ApiProperty({ type: [CreateUpdateUsageArreteRestrictionDto] })
  usagesArreteRestriction: CreateUpdateUsageArreteRestrictionDto[];
}
