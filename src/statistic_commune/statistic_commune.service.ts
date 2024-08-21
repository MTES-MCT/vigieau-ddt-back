import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StatisticCommune } from './entities/statistic_commune.entity';
import { ZoneAlerteComputed } from '../zone_alerte_computed/entities/zone_alerte_computed.entity';
import { RegleauLogger } from '../logger/regleau.logger';
import { CommuneService } from '../commune/commune.service';
import { ZoneAlerteComputedService } from '../zone_alerte_computed/zone_alerte_computed.service';
import { ZoneAlerteService } from '../zone_alerte/zone_alerte.service';
import { Commune } from '../commune/entities/commune.entity';
import { Utils } from '../core/utils';
import moment from 'moment/moment';

@Injectable()
export class StatisticCommuneService {
  private readonly logger = new RegleauLogger('StatisticCommuneService');

  constructor(
    @InjectRepository(StatisticCommune)
    private readonly statisticCommuneRepository: Repository<StatisticCommune>,
    private readonly communeService: CommuneService,
    @Inject(forwardRef(() => ZoneAlerteComputedService))
    private readonly zoneAlerteComputedService: ZoneAlerteComputedService,
    private readonly zoneAlerteService: ZoneAlerteService,
  ) {
    setTimeout(() => {
      // this.computeByMonth()
    }, 5000);
  }

  async computeCommuneStatisticsRestrictions(zones: ZoneAlerteComputed[], date: Date) {
    this.logger.log(`COMPUTING COMMUNE STATISTICS RESTRICTIONS - ${date.toISOString().split('T')[0]}`);
    const communes = await this.communeService.findAllLight();

    for (let i = 0; i < communes.length; i++) {
      const c = communes[i];
      let statCommune = await this.statisticCommuneRepository.findOne({
        select: {
          id: true,
          restrictions: true,
          restrictionsByMonth: true,
          commune: {
            id: true,
            code: true,
          },
        },
        relations: ['commune'],
        where: {
          commune: {
            id: c.id,
          }
        }
      });
      if (!statCommune) {
        // @ts-ignore
        statCommune = {
          commune: c,
          restrictions: [],
        };
      }
      if (!statCommune.restrictions) {
        statCommune.restrictions = [];
      }

      let restrictionIndex = statCommune.restrictions.findIndex(r => r.date === date.toISOString().split('T')[0]);
      const restriction = {
        date: date.toISOString().split('T')[0],
        SOU: null,
        SUP: null,
        AEP: null,
      };
      const zonesDep = zones.filter(z => z.departement.code === c.departement.code);
      // let zonesCommune = zonesDep.length > 0 ? await this.zoneAlerteComputedService.getZonesIntersectedWithCommune(zonesDep, c.id) : [];
      // @ts-ignore
      let zonesCommune = zonesDep.length > 0 ? await this.zoneAlerteService.getZonesIntersectedWithCommune(zonesDep, c.id) : [];
      zonesCommune = zonesDep.filter(z => zonesCommune.some(zc => zc.id === z.id));
      const zonesType = ['SUP', 'SOU', 'AEP'];
      const niveauxGravite = ['vigilance', 'alerte', 'alerte_renforcee', 'crise'];

      zonesType.forEach(zoneType => {
        const zonesCommuneType = zonesCommune.filter(z => z.type === zoneType);

        niveauxGravite.forEach(niveauGravite => {
          if (zonesCommuneType.some(z => z.restriction.niveauGravite === niveauGravite)) {
            restriction[zoneType] = niveauGravite;
          }
        });
      });

      if (restrictionIndex >= 0) {
        statCommune.restrictions[restrictionIndex] = restriction;
      } else {
        statCommune.restrictions.push(restriction);
      }
      statCommune.restrictions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (statCommune.id) {
        await this.statisticCommuneRepository.update({ id: statCommune.id }, { restrictions: statCommune.restrictions });
      } else {
        await this.statisticCommuneRepository.save(statCommune);
      }
    }
  }

  async computeByMonth() {
    this.logger.log('COMPUTE BY MONTH');

    const dateDebut = moment('01/01/2013', 'DD/MM/YYYY');
    const dateFin = moment('31/10/2018', 'DD/MM/YYYY');

    const communes = await this.communeService.findAllLight();

    for (let m = moment(dateDebut); m.diff(dateFin, 'days') <= 0; m.add(1, 'month')) {
      this.logger.log(`COMPUTE STAT BY MONTH ${m.format('YYYY-MM')}`);
      await this.computeCommuneStatisticsRestrictionsByMonth(m.toDate(), communes);
    }
  }

  async computeCommuneStatisticsRestrictionsByMonth(date: Date, communes: Commune[]) {
    const dateMoment = moment(date);

    for (let i = 0; i < communes.length; i++) {
      const c = communes[i];
      let statCommune = await this.statisticCommuneRepository.findOne({
        select: {
          id: true,
          restrictions: true,
          restrictionsByMonth: true,
          commune: {
            id: true,
            code: true,
          },
        },
        relations: ['commune'],
        where: {
          commune: {
            id: c.id,
          }
        }
      });
      if (!statCommune) {
        continue;
      }
      if (!statCommune.restrictionsByMonth) {
        statCommune.restrictionsByMonth = [];
      }

      let restrictionByMonthIndex = statCommune.restrictionsByMonth.findIndex(r => r.date === dateMoment.format('YYYY-MM'));
      const restrictionByMonth = {
        date: dateMoment.format('YYYY-MM'),
        ponderation: 0,
      };
      const allRestrictionsByMonth = statCommune.restrictions.filter(r => moment(r.date, 'YYYY-MM-DD').format('YYYY-MM') === dateMoment.format('YYYY-MM'));
      for (const restriction of allRestrictionsByMonth) {
        const niveauGraviteMax = [
          Utils.getNiveau(restriction.AEP),
          Utils.getNiveau(restriction.SOU),
          Utils.getNiveau(restriction.SUP),
        ]
          .reduce((prev, current) => {
            return prev > current ? prev : current;
          });

        restrictionByMonth.ponderation += this.getPonderation(niveauGraviteMax);
      }

      if (restrictionByMonthIndex >= 0) {
        statCommune.restrictionsByMonth[restrictionByMonthIndex] = restrictionByMonth;
      } else {
        statCommune.restrictionsByMonth.push(restrictionByMonth);
      }
      statCommune.restrictionsByMonth.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      await this.statisticCommuneRepository.update({ id: statCommune.id }, { restrictionsByMonth: statCommune.restrictionsByMonth });
    }
  }

  getPonderation(niveauGravite) {
    switch (niveauGravite) {
      case 2:
        return 0.5;
      case 3:
        return 2;
      case 4:
        return 3;
      case 5:
        return 4;
      default:
        return 0;
    }
  }
}
