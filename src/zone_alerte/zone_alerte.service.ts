import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoneAlerte } from './entities/zone_alerte.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ZoneAlerteService {
  constructor(
    @InjectRepository(ZoneAlerte)
    private readonly zoneAlerteRepository: Repository<ZoneAlerte>,
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
        'ST_AsGeoJSON(ST_TRANSFORM(zone_alerte.geom, 4326), 3)',
        'geom',
      )
      .leftJoin('zone_alerte.arretesCadre', 'arrete_cadre')
      .where('arrete_cadre.id = :acId', { acId })
      .getRawMany();
  }

  /**
   * Vérification régulière s'il n'y a pas de nouvelles zones
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateZones() {
    /**
     * TODO
     * Appel à l'API SANDRE
     * Vérifier si des nouvelles ZA sont présentes
     * Si non, RAS
     * Si oui, les ajouter en BDD et désactiver les anciennes
     * Récupérer les codes des ZA qui ne peuvent pas être migrées
     * Récupérer les AC qui n'ont QUE des ZAs pouvant être migrées
     * Pour les AC ne comportant que des ZA pouvant être migrées, les migrer
     */
  }
}
