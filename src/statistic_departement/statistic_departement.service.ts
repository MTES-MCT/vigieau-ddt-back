import { Injectable } from '@nestjs/common';
import { RegleauLogger } from '../logger/regleau.logger';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, MoreThanOrEqual, Repository } from 'typeorm';
import { StatisticDepartement } from './entities/statistic_departement.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Statistic } from '../statistic/entities/statistic.entity';
import { DepartementService } from '../departement/departement.service';
import { AbonnementMail } from '../core/entities/abonnement_mail.entity';
import { ZoneAlerteService } from '../zone_alerte/zone_alerte.service';
import { User } from '../user/entities/user.entity';

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
    private readonly zoneAlerteService: ZoneAlerteService,
  ) {
    this.loadStatDep();
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
        zones: {
          pas_restriction: 0,
          vigilance: 0,
          alerte: 0,
          alerte_renforcee: 0,
          crise: 0,
        },
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

      const zones = await this.zoneAlerteService.findByDepartementWithRestrictions(d.code);
      zones.forEach(z => {
        if (!z.restrictions || !z.restrictions[0] || !z.restrictions[0].niveauGravite) {
          statisticDepartement.zones.pas_restriction++;
        } else {
          statisticDepartement.zones[z.restrictions[0].niveauGravite]++;
        }
      });

      this.logger.log(`Deleting and saving statistic departement for ${d.code}`);
      await this.statisticDepartementRepository.delete({ departement: { id: d.id } });
      await this.statisticDepartementRepository.save(statisticDepartement);
    }
    this.loadStatDep();
  }
}