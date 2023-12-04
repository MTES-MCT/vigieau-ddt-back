import { Controller, Get } from '@nestjs/common';
import { ZoneAlerteService } from './zone_alerte.service';
import { ApiOperation } from '@nestjs/swagger';
import { ZoneAlerte } from './entities/zone_alerte.entity';
import { plainToInstance } from 'class-transformer';
import * as camelcaseKeys from 'camelcase-keys';
import { ZoneAlerteDto } from './dto/zone_alerte.dto';

@Controller('zone-alerte')
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
