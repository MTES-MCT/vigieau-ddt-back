import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AcUpdateZoneAlerteDto } from '../../arrete_cadre/dto/create_update_arrete_cadre.dto';
import { CreateUpdateUsageArreteRestrictionDto } from '../../usage_arrete_restriction/dto/create_update_usage_arrete_restriction.dto';

export class CreateUpdateRestrictionDto {
  @IsNumber()
  @IsOptional()
  @ApiProperty({ example: 1, description: 'Identifiant BDD' })
  id: number;

  @IsObject()
  @ValidateNested()
  @Type(() => AcUpdateZoneAlerteDto)
  @ApiProperty({ type: AcUpdateZoneAlerteDto })
  zoneAlerte: AcUpdateZoneAlerteDto;

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
