import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { ZoneAlerte } from './entities/zone_alerte.entity';
import { DepartementService } from '../departement/departement.service';
import {
  ZoneAlerteComparaisonDepartement,
  ZoneAlerteComparaisonZone,
} from './dto/zone_alerte_verification.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ZoneAlerteService {
  constructor(
    @InjectRepository(ZoneAlerte)
    private readonly zoneAlerteRepository: Repository<ZoneAlerte>,
    private readonly departementService: DepartementService,
  ) {}

  findByDepartement(departementCode: string): Promise<ZoneAlerte[]> {
    return this.zoneAlerteRepository.find({
      relations: ['departement'],
      where: {
        departement: {
          code: departementCode,
        },
        disabled: false,
      },
    });
  }

  findByArreteCadre(acId: number): Promise<ZoneAlerte[]> {
    return this.zoneAlerteRepository
      .createQueryBuilder('zone_alerte')
      .select('zone_alerte.id', 'id')
      .addSelect('zone_alerte.code', 'code')
      .addSelect('zone_alerte.nom', 'nom')
      .addSelect('zone_alerte.type', 'type')
      .addSelect(
        'ST_AsGeoJSON(ST_TRANSFORM(zone_alerte.geom, 4326), 4)',
        'geom',
      )
      .leftJoin('zone_alerte.arretesCadre', 'arrete_cadre')
      .where('arrete_cadre.id = :acId', { acId })
      .getRawMany();
  }

  /**
   * Vérification régulière si il n'y a pas de nouvelles zones
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateZones() {
    // TODO appel à l'API SANDRE
  }
}
