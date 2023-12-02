import { PartialType } from '@nestjs/swagger';
import { CreateZoneAlerteDto } from './create-zone_alerte.dto';

export class UpdateZoneAlerteDto extends PartialType(CreateZoneAlerteDto) {}
