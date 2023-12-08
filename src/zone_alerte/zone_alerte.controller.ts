import { Controller, Get, UseGuards } from '@nestjs/common';
import { ZoneAlerteService } from './zone_alerte.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZoneAlerte } from './entities/zone_alerte.entity';
import { plainToInstance } from 'class-transformer';
import * as camelcaseKeys from 'camelcase-keys';
import { ZoneAlerteDto } from './dto/zone_alerte.dto';
import { AuthenticatedGuard } from '../core/guards/authenticated.guard';

@UseGuards(AuthenticatedGuard)
@Controller('zone-alerte')
@ApiTags("Zones d'alertes")
export class ZoneAlerteController {
  constructor(private readonly zoneAlerteService: ZoneAlerteService) {}

  @Get()
  @ApiOperation({ summary: "Retourne toute les zones d'alerte" })
  async findAll(): Promise<ZoneAlerteDto[]> {
    const zonesAlerte: ZoneAlerte[] = await this.zoneAlerteService.findAll();
    return plainToInstance(
      ZoneAlerteDto,
      camelcaseKeys(zonesAlerte, { deep: true }),
    );
  }
}
