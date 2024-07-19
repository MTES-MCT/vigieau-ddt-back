import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RegleauLogger } from '../logger/regleau.logger';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, MoreThanOrEqual, Repository } from 'typeorm';
import { StatisticDepartement } from './entities/statistic_departement.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Statistic } from '../statistic/entities/statistic.entity';
import { DepartementService } from '../departement/departement.service';
import { AbonnementMail } from '../core/entities/abonnement_mail.entity';
import { User } from '../user/entities/user.entity';
import { ZoneAlerteComputed } from '../zone_alerte_computed/entities/zone_alerte_computed.entity';
import { ZoneAlerteComputedService } from '../zone_alerte_computed/zone_alerte_computed.service';

@Injectable()
export class StatisticDepartementService {
  private readonly logger = new RegleauLogger('StatisticDepartementService');
  private statisticDepartements: StatisticDepartement[] = [];
  releaseDate = '2023-07-12';

  constructor(
    @InjectRepository(StatisticDepartement)
    private readonly statisticDepartementRepository: Repository<StatisticDepartement>,
    @InjectRepository(Statistic)
    private readonly statisticRepository: Repository<Statistic>,
    @InjectRepository(AbonnementMail)
    private readonly abonnementMailRepository: Repository<AbonnementMail>,
    private readonly departementService: DepartementService,
    @Inject(forwardRef(() => ZoneAlerteComputedService))
    private readonly zoneAlerteComputedService: ZoneAlerteComputedService,
  ) {
    this.loadStatDep();
    setTimeout(() => {
        this.computeDepartementStatistics();
      }, 5000,
    );
  }

  findAll(currentUser: User): StatisticDepartement[] {
    if (!currentUser || currentUser.role === 'mte') {
      return this.statisticDepartements;
    } else {
      return this.statisticDepartements.filter(s => currentUser.role_departements.includes(s.departement.code));
    }
  }

  async loadStatDep() {
    this.statisticDepartements = await this.statisticDepartementRepository.find({
      relations: ['departement'],
    });
  }

  @Cron(CronExpression.EVERY_2_HOURS)
  async computeDepartementStatistics() {
    this.logger.log('Computing departement statistics...');
    const statsDepartement: StatisticDepartement[] = await this.statisticDepartementRepository.find({
      select: {
        id: true,
        departement: {
          id: true,
          code: true,
        },
      },
      relations: ['departement'],
    });
    const stats: Statistic[] = await this.statisticRepository.find({
      where: {
        date: MoreThanOrEqual(this.releaseDate),
      },
      order: {
        date: 'ASC',
      },
    });

    const departements = await this.departementService.findAllLight();

    for (const d of departements) {
      const statisticDepartement = {
        departement: d,
        visits: [],
        totalVisits: 0,
        weekVisits: 0,
        monthVisits: 0,
        yearVisits: 0,
        subscriptions: 0,
      };

      for (const statByDay of stats) {
        const depVisits = statByDay.departementRepartition ? statByDay.departementRepartition[d.code] : 0;
        statisticDepartement.totalVisits += depVisits;
        statisticDepartement.visits.push({
          date: statByDay.date,
          visits: depVisits,
        });

        const today = new Date();
        const date = new Date(statByDay.date);
        const diffInTime = today.getTime() - date.getTime();
        const diffInDays = Math.round(diffInTime / (1000 * 3600 * 24));

        if (diffInDays <= 7) {
          statisticDepartement.weekVisits += depVisits;
        }
        if (diffInDays <= 30) {
          statisticDepartement.monthVisits += depVisits;
        }
        if (diffInDays <= 365) {
          statisticDepartement.yearVisits += depVisits;
        }
      }

      statisticDepartement.subscriptions = await this.abonnementMailRepository.count({
        where: {
          commune: Like(`${d.code}${d.code.length === 2 ? '___' : '__'}`),
        },
      });

      this.logger.log(`Saving statistic departement for ${d.code}`);
      const statDepartement = statsDepartement.find(s => s.departement.id === d.id);
      if (statDepartement) {
        await this.statisticDepartementRepository.update({ id: statDepartement.id }, statisticDepartement);
      } else {
        await this.statisticDepartementRepository.save(statisticDepartement);
      }
    }
    this.loadStatDep();
  }

  async computeDepartementStatisticsRestrictions(zones: ZoneAlerteComputed[], date: Date) {
    this.logger.log('Computing departement statistics restrictions ...');
    const statsDepartement: StatisticDepartement[] = await this.statisticDepartementRepository.find({
      select: {
        id: true,
        restrictions: true,
        departement: {
          id: true,
          code: true,
        },
      },
      relations: ['departement'],
    });

    const departements = await this.departementService.findAllLight();

    for (const d of departements) {
      let statDepartement = statsDepartement.find(s => s.departement.code === d.code);
      if (!statDepartement) {
        // @ts-ignore
        statDepartement = {
          departement: d,
          visits: [],
          totalVisits: 0,
          weekVisits: 0,
          monthVisits: 0,
          yearVisits: 0,
          subscriptions: 0,
          restrictions: [],
        };
      }
      if(!statDepartement.restrictions) {
        statDepartement.restrictions = [];
      }

      let restrictionIndex = statDepartement.restrictions.findIndex(r => r.date === date.toISOString().split('T')[0]);
      const restriction = {
        date: date.toISOString().split('T')[0],
        SOU: {
          vigilance: 0,
          alerte: 0,
          alerte_renforcee: 0,
          crise: 0,
        },
        SUP: {
          vigilance: 0,
          alerte: 0,
          alerte_renforcee: 0,
          crise: 0,
        },
        AEP: {
          vigilance: 0,
          alerte: 0,
          alerte_renforcee: 0,
          crise: 0,
        },
      };
      const zonesDep = zones.filter(z => z.departement.code === d.code);
      const zonesType = ['SUP', 'SOU', 'AEP'];
      const niveauxGravite = ['vigilance', 'alerte', 'alerte_renforcee', 'crise'];
      for (let i = 0; i < zonesType.length; i++) {
        const type = zonesType[i];
        const zonesDepType = zonesDep.filter(z => z.type === type);
        for (let j = 0; j < niveauxGravite.length; j++) {
          const niveauGravite = niveauxGravite[j];
          const zonesDepTypeNiveauGravite = zonesDepType.filter(z => z.restriction?.niveauGravite === niveauGravite);
          restriction[type][niveauGravite] = zonesDepTypeNiveauGravite.length > 0 ?
            (await this.zoneAlerteComputedService.getZonesArea(zonesDepTypeNiveauGravite)).area?.toFixed(2) : 0;
        }
      }
      if (restrictionIndex >= 0) {
        statDepartement.restrictions[restrictionIndex] = restriction;
      } else {
        statDepartement.restrictions.push(restriction);
      }

      if (statDepartement.id) {
        await this.statisticDepartementRepository.update({ id: statDepartement.id }, { restrictions: statDepartement.restrictions });
      } else {
        await this.statisticDepartementRepository.save(statDepartement);
      }
    }
  }
}