import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commune } from './entities/commune.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DepartementService } from '../departement/departement.service';
import { firstValueFrom } from 'rxjs';
import { RegleauLogger } from '../logger/regleau.logger';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CommuneService {
  private readonly logger = new RegleauLogger('CommuneService');

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Commune)
    private readonly communeRepository: Repository<Commune>,
    private readonly departementService: DepartementService,
    private readonly configService: ConfigService,
  ) {
    this.initDatas();
  }

  async initDatas() {
    const communes = await this.communeRepository.count();
    if(communes === 0) {
      this.updateCommuneRef();
    }
  }

  async find(depCode?: string, withGeom?: boolean): Promise<Commune[]> {
    const qb = this.communeRepository
      .createQueryBuilder('commune')
      .select('commune.id', 'id')
      .addSelect('commune.code', 'code')
      .addSelect('commune.nom', 'nom');

    if (withGeom) {
      qb.addSelect('ST_AsGeoJSON(ST_TRANSFORM(commune.geom, 4326), 3)', 'geom');
    }

    return qb
      .leftJoin('commune.departement', 'departement')
      .where('departement.code = :depCode', { depCode })
      .getRawMany();
  }

  getUnionGeomOfCommunes(communes: Commune[]): Promise<any> {
    return this.communeRepository
      .createQueryBuilder('commune')
      .select('ST_AsGeoJSON(ST_UNION(ST_TRANSFORM(commune.geom, 4326)))', 'geom')
      .where('commune.id IN(:...communesId)', { communesId: communes.map((c) => c.id) })
      .getRawOne();
  }

  async getZoneAlerteComputedForHarmonisation(depId: number) {
    const rawMany = await this.communeRepository
      .createQueryBuilder('commune')
      .select('commune.id', 'id')
      .addSelect('commune.code', 'code')
      .addSelect('commune.nom', 'nom')
      .addSelect('zac.id', 'zac_id')
      .addSelect('zac.nom', 'zac_nom')
      .addSelect('zac.type', 'zac_type')
      .addSelect('zac.niveauGravite', 'zac_niveau_gravite')
      .addSelect('ST_Area(commune.geom)', 'area')
      .addSelect('ST_Area(zac.geom)', 'zac_area')
      .addSelect('ST_Area(ST_Intersection(zac.geom, commune.geom))', 'zac_commune_area')
      .leftJoin('zone_alerte_computed', 'zac', `zac."departementId" = commune."departementId" and ST_Intersects(zac.geom, commune.geom)`)
      .where('commune."departementId" = :depId', { depId })
      .andWhere('zac.id IS NOT NULL')
      .getRawMany();
    const toReturn = [];
    rawMany.forEach((c) => {
      if(!toReturn.find((t) => t.id === c.id)) {
        toReturn.push({
          id: c.id,
          code: c.code,
          nom: c.nom,
          area: c.area,
          zones: [],
        });
      }
      const commune = toReturn.find((t) => t.id === c.id);
      commune.zones.push({
        id: c.zac_id,
        nom: c.zac_nom,
        type: c.zac_type,
        niveauGravite: c.zac_niveau_gravite,
        area: c.zac_area,
        areaCommune: c.zac_commune_area,
        areaCommunePercentage: (c.zac_commune_area / c.area) * 100,
      });
    });
    return toReturn;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateCommuneRef() {
    this.logger.log('MISE A JOUR DES COMMUNES');
    let communesUpdated = 0;
    let communesAdded = 0;
    const departements = await this.departementService.findAllLight();
    for (const d of departements) {
      const url = `${this.configService.get('API_GEO')}/departements/${d.code}/communes?fields=code,nom,contour,population`;
      const { data } = await firstValueFrom(this.httpService.get(url));
      for (const c of data) {
        const communeExisting = await this.communeRepository.findOne({
          where: { code: c.code },
        });
        if (communeExisting) {
          communeExisting.nom = c.nom;
          communeExisting.departement = d;
          communeExisting.population = c.population;
          communeExisting.geom = c.contour;
          await this.communeRepository.save(communeExisting);
          communesUpdated++;
        } else {
          await this.communeRepository.save({
            code: c.code,
            nom: c.nom,
            population: c.population,
            geom: c.contour,
            departement: d,
          });
          communesAdded++;
        }
      }
    }
    this.logger.log(`${communesUpdated} COMMUNES MIS A JOUR`);
    this.logger.log(`${communesAdded} COMMUNES AJOUTEES`);
  }
}
