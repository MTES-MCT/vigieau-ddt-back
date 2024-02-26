import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commune } from './entities/commune.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DepartementService } from '../departement/departement.service';
import { firstValueFrom } from 'rxjs';
import { RegleauLogger } from '../logger/regleau.logger';

@Injectable()
export class CommuneService {
  private readonly logger = new RegleauLogger('CommuneService');

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Commune)
    private readonly communeRepository: Repository<Commune>,
    private readonly departementService: DepartementService,
  ) {
    this.updateCommuneRef();
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async updateCommuneRef() {
    this.logger.log('MISE A JOUR DES COMMUNES');
    let communesUpdated = 0;
    let communesAdded = 0;
    const departements = await this.departementService.findAllLight();
    for (const d of departements) {
      const url = `https://geo.api.gouv.fr/departements/${d.code}/communes?fields=code,nom,contour,population`;
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
