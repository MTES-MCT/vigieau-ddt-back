import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoneAlerte } from './entities/zone_alerte.entity';

@Injectable()
export class ZoneAlerteService {
  constructor(
    @InjectRepository(ZoneAlerte)
    private readonly zoneAlerteRepository: Repository<ZoneAlerte>,
  ) {}

  findAll(): Promise<ZoneAlerte[]> {
    return this.zoneAlerteRepository.find();
  }
}
