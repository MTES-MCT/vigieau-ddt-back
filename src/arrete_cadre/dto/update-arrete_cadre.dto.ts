import { PartialType } from '@nestjs/swagger';
import { CreateArreteCadreDto } from './create-arrete_cadre.dto';

export class UpdateArreteCadreDto extends PartialType(CreateArreteCadreDto) {}
