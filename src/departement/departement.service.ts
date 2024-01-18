import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Departement } from './entities/departement.entity';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DepartementService {
  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Departement)
    private readonly departementRepository: Repository<Departement>,
    private readonly configService: ConfigService,
  ) {
    if (configService.get('NODE_ENV') !== 'local') {
      this.updateDepartementsGeom();
    }
  }

  findAll(): Promise<Departement[]> {
    return this.departementRepository
      .createQueryBuilder('departement')
      .select([
        'departement.id',
        'departement.code',
        'departement.nom',
        'zonesAlerte.id',
        'zonesAlerte.nom',
        'zonesAlerte.code',
        'zonesAlerte.type',
        'arretesCadre.id',
      ])
      .leftJoin('departement.zonesAlerte', 'zonesAlerte')
      .leftJoin(
        'zonesAlerte.arretesCadre',
        'arretesCadre',
        'arretesCadre.statut IN (:...acStatut)',
        { acStatut: ['a_venir', 'publie'] },
      )
      .where('zonesAlerte.disabled = false')
      .orderBy('departement.code', 'ASC')
      .getMany();
  }

  find(departementId: number): Promise<Departement> {
    return this.departementRepository.findOne({
      select: ['id', 'code', 'nom'],
      where: {
        id: departementId,
      },
    });
  }

  findByCode(departementCode: string): Promise<Departement> {
    return this.departementRepository.findOne({
      select: ['id', 'code', 'nom'],
      where: {
        code: departementCode,
      },
    });
  }

  findByArreteCadreId(acId: number): Promise<Departement[]> {
    return this.departementRepository.find({
      select: ['id', 'code', 'nom'],
      where: {
        arretesCadre: {
          id: acId,
        },
      },
    });
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async updateDepartementsGeom() {
    console.log('MISE A JOUR DES DEPARTEMENTS');
    const { data } = await firstValueFrom(
      this.httpService.get(
        'http://etalab-datasets.geo.data.gouv.fr/contours-administratifs/2023/geojson/departements-5m.geojson',
      ),
    );
    const toUpdate = data.features.map((feature) => {
      return {
        code: feature.properties.code,
        geom: feature.geometry,
      };
    });
    const sqlQueries = toUpdate.map((tmp) => {
      return this.departementRepository.update(
        {
          code: tmp.code,
        },
        {
          geom: tmp.geom,
        },
      );
    });
    await Promise.all(sqlQueries);
    await this.departementRepository.update(
      {},
      {
        geom: () => `ST_TRANSFORM(geom, 2154)`,
      },
    );
    console.log('DEPARTEMENTS MIS A JOUR');
  }
}
