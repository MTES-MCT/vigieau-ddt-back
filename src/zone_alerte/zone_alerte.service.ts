import { Injectable } from '@nestjs/common';
import { CreateZoneAlerteDto } from './dto/create-zone_alerte.dto';
import { UpdateZoneAlerteDto } from './dto/update-zone_alerte.dto';

@Injectable()
export class ZoneAlerteService {
  create(createZoneAlerteDto: CreateZoneAlerteDto) {
    return 'This action adds a new zoneAlerte';
  }

  findAll() {
    return `This action returns all zoneAlerte`;
  }

  findOne(id: number) {
    return `This action returns a #${id} zoneAlerte`;
  }

  update(id: number, updateZoneAlerteDto: UpdateZoneAlerteDto) {
    return `This action updates a #${id} zoneAlerte`;
  }

  remove(id: number) {
    return `This action removes a #${id} zoneAlerte`;
  }
}
