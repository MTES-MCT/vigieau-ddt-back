import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ZoneAlerteService } from './zone_alerte.service';
import { CreateZoneAlerteDto } from './dto/create-zone_alerte.dto';
import { UpdateZoneAlerteDto } from './dto/update-zone_alerte.dto';

@Controller('zone-alerte')
export class ZoneAlerteController {
  constructor(private readonly zoneAlerteService: ZoneAlerteService) {}

  @Post()
  create(@Body() createZoneAlerteDto: CreateZoneAlerteDto) {
    return this.zoneAlerteService.create(createZoneAlerteDto);
  }

  @Get()
  findAll() {
    return this.zoneAlerteService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.zoneAlerteService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateZoneAlerteDto: UpdateZoneAlerteDto) {
    return this.zoneAlerteService.update(+id, updateZoneAlerteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.zoneAlerteService.remove(+id);
  }
}
