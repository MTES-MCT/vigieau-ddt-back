import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoneAlerte } from './entities/zone_alerte.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RegleauLogger } from '../logger/regleau.logger';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { DepartementService } from '../departement/departement.service';
import { BassinVersantService } from '../bassin_versant/bassin_versant.service';

@Injectable()
export class ZoneAlerteService {
  private readonly logger = new RegleauLogger('ZoneAlerteService');

  constructor(
    @InjectRepository(ZoneAlerte)
    private readonly zoneAlerteRepository: Repository<ZoneAlerte>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly departementService: DepartementService,
    private readonly bassinVersantService: BassinVersantService,
  ) {
  }

  findOne(id: number): Promise<any> {
    return this.zoneAlerteRepository
      .createQueryBuilder('zone_alerte')
      .select('zone_alerte.id', 'id')
      .addSelect('zone_alerte.code', 'code')
      .addSelect('zone_alerte.nom', 'nom')
      .addSelect('zone_alerte.type', 'type')
      .addSelect(
        'ST_AsGeoJSON(ST_TRANSFORM(zone_alerte.geom, 4326))',
        'geom',
      )
      .where('zone_alerte.id = :id', { id })
      .getRawOne();
  }

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

  getIntersect(zoneId: number, otherZonesId: number[]) {
    return this.zoneAlerteRepository
      .createQueryBuilder('zone_alerte')
      .select('zone_alerte.id', 'id')
      .addSelect('zone_alerte.code', 'code')
      .addSelect('zone_alerte.nom', 'nom')
      .addSelect('zone_alerte.type', 'type')
      .where('zone_alerte.disabled = false')
      .andWhere('zone_alerte.id != :id', { id: zoneId })
      .andWhere('zone_alerte.id IN(:...ids)', { ids: otherZonesId })
      .andWhere('ST_INTERSECTS(zone_alerte.geom, (SELECT zaBis.geom FROM zone_alerte as zaBis WHERE id = :id))', { id: zoneId })
      .getRawMany();
  }

  computeNewZone(zone: any) {
    const qb = this.zoneAlerteRepository
      .createQueryBuilder('zone_alerte');
    let sqlString = `ST_AsGeoJSON(ST_TRANSFORM(`;
    if (zone.remove && zone.remove.length > 0) {
      sqlString += `ST_DIFFERENCE(zone_alerte.geom, `;
      sqlString += `(SELECT ST_UNION(zaBis.geom) FROM zone_alerte as zaBis WHERE zaBis.id IN (${zone.remove.join(', ')}))`;
      sqlString += `)`;
    } else {
      sqlString += `zone_alerte.geom`;
    }
    sqlString += `, 4326))`;
    return qb.select(sqlString, 'geom')
      .where('zone_alerte.id = :id', { id: zone.id })
      .getRawOne();
  }

  /**
   * Vérification régulière s'il n'y a pas de nouvelles zones
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async updateZones() {
    this.logger.log('MISE A JOUR DES ZONES D\'ALERTE');
    let zonesUpdates = 0;
    let zonesAdded = 0;
    let lastUpdate = (await this.zoneAlerteRepository.createQueryBuilder('zone_alerte')
      .select('MAX(zone_alerte.createdAt)', 'createdAt')
      .getRawOne()).createdAt;
    lastUpdate = lastUpdate ? lastUpdate.toISOString().split('T')[0] : null;
    const filterString = lastUpdate ? `Filter=<Filter><PropertyIsGreaterThanOrEqualTo><PropertyName>DateMajZAS</PropertyName><Literal>${lastUpdate}</Literal></PropertyIsGreaterThanOrEqualTo></Filter>` : '';
    const url = `${this.configService.get('API_SANDRE')}/geo/zas?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&typename=ZAS&SRSNAME=EPSG:4326&OUTPUTFORMAT=GeoJSON&${filterString}`;
    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      for (const [index, f] of data.features.entries()) {
        let existingZone = await this.zoneAlerteRepository.findOne({
          where: {
            code: f.properties.CdAltZAS,
            type: f.properties.TypeZAS,
            departement: {
              code: f.properties.CdDepartement,
            },
          },
        });
        if (!existingZone || (existingZone.idSandre && existingZone.idSandre !== +f.properties.gid)) {
          zonesAdded++;
          existingZone = new ZoneAlerte();
          existingZone.code = f.properties.CdAltZAS;
          existingZone.departement = await this.departementService.findByCode(f.properties.CdDepartement);
          existingZone.bassinVersant = await this.bassinVersantService.findByCode(+f.properties.NumCircAdminBassin);
          existingZone.idSandre = +f.properties.gid;
          existingZone.type = f.properties.TypeZAS;
        } else {
          zonesUpdates++;
        }
        existingZone.nom = f.properties.LbZAS;
        existingZone.numeroVersionSandre = f.properties.NumeroVersionZAS ? f.properties.NumeroVersionZAS : null;
        existingZone.geom = f.geometry;
        if (f.properties.StZAS === 'Gelé') {
          existingZone.disabled = true;
        }
        await this.zoneAlerteRepository.save(existingZone);
        this.logger.log(`${index} - ZONE ${existingZone.id} ${existingZone.code} ENREGISTREE`);
      }
    } catch (error) {
      this.logger.error('ERREUR LORS DE LA MISE A JOUR DES ZONES D\'ALERTES', error);
    }
    this.logger.log(`${zonesUpdates} ZONES D'ALERTES MIS A JOUR`);
    this.logger.log(`${zonesAdded} ZONES D'ALERTES AJOUTEES`);
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
