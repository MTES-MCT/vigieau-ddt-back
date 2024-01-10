import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  DeleteResult,
  FindOptionsWhere,
  In,
  LessThan,
  LessThanOrEqual,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { paginate, Paginated, PaginateQuery } from 'nestjs-paginate';
import { CreateUpdateArreteCadreDto } from './dto/create_update_arrete_cadre.dto';
import { UsageArreteCadreService } from '../usage_arrete_cadre/usage_arrete_cadre.service';
import { arreteCadrePaginateConfig } from './dto/arrete_cadre.dto';
import { testArretesCadre } from '../core/test/data';
import { PublishArreteCadreDto } from './dto/publish_arrete_cadre.dto';
import { StatutArreteCadre } from './type/arrete_cadre.type';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RegleauLogger } from '../logger/regleau.logger';

@Injectable()
export class ArreteCadreService {
  private readonly logger = new RegleauLogger('ArreteCadreService');

  constructor(
    @InjectRepository(ArreteCadre)
    private readonly arreteCadreRepository: Repository<ArreteCadre>,
    private readonly uageArreteCadreService: UsageArreteCadreService,
  ) {}

  findAll(
    curentUser: User,
    query: PaginateQuery,
  ): Promise<Paginated<ArreteCadre>> {
    const whereClause: FindOptionsWhere<ArreteCadre> | null =
      curentUser.role === 'mte'
        ? null
        : {
            zonesAlerte: {
              departement: {
                code: curentUser.role_departement,
              },
            },
          };
    const paginateConfig = arreteCadrePaginateConfig;
    paginateConfig.where = whereClause ? whereClause : null;
    return paginate(query, this.arreteCadreRepository, paginateConfig);
  }

  async findOne(id: number, curentUser?: User) {
    const whereClause: FindOptionsWhere<ArreteCadre> | null =
      !curentUser || curentUser.role === 'mte'
        ? { id }
        : {
            id,
            zonesAlerte: {
              departement: {
                code: curentUser.role_departement,
              },
            },
          };
    const [arreteCadre, usagesArreteCadre] = await Promise.all([
      this.arreteCadreRepository.findOne({
        select: {
          id: true,
          numero: true,
          dateDebut: true,
          dateFin: true,
          url: true,
          urlDdt: true,
          statut: true,
          departements: {
            id: true,
            code: true,
            nom: true,
          },
          zonesAlerte: {
            id: true,
            code: true,
            nom: true,
            type: true,
          },
          arretesRestriction: {
            id: true,
            statut: true,
          },
        },
        relations: ['departements', 'zonesAlerte', 'arretesRestriction'],
        where: whereClause,
      }),
      this.uageArreteCadreService.findByArreteCadre(id),
    ]);
    if (arreteCadre) {
      arreteCadre.usagesArreteCadre = usagesArreteCadre;
    }
    return arreteCadre;
  }

  async create(
    createArreteCadreDto: CreateUpdateArreteCadreDto,
  ): Promise<ArreteCadre> {
    const arreteCadre =
      await this.arreteCadreRepository.save(createArreteCadreDto);
    arreteCadre.usagesArreteCadre =
      await this.uageArreteCadreService.updateAll(arreteCadre);
    return arreteCadre;
  }

  async update(
    id: number,
    updateArreteCadreDto: CreateUpdateArreteCadreDto,
    curentUser: User,
  ): Promise<ArreteCadre> {
    if (!(await this.canUpdateArreteCadre(id, curentUser))) {
      throw new HttpException(
        `Vous ne pouvez éditer un arrêté cadre que si il est sur votre département et en statut brouillon.`,
        HttpStatus.FORBIDDEN,
      );
    }
    const arreteCadre = await this.arreteCadreRepository.save({
      id,
      ...updateArreteCadreDto,
    });
    arreteCadre.usagesArreteCadre =
      await this.uageArreteCadreService.updateAll(arreteCadre);
    return arreteCadre;
  }

  async publish(
    id: number,
    publishArreteCadreDto: PublishArreteCadreDto,
    currentUser: User,
  ): Promise<ArreteCadre> {
    if (
      publishArreteCadreDto.dateFin &&
      new Date(publishArreteCadreDto.dateFin) <
        new Date(publishArreteCadreDto.dateDebut)
    ) {
      throw new HttpException(
        `La date de fin doit être postérieure à la date de début.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!(await this.canUpdateArreteCadre(id, currentUser))) {
      return;
    }
    const toSave = {
      id,
      ...publishArreteCadreDto,
      ...{ statut: <StatutArreteCadre>'a_venir' },
    };
    return this.arreteCadreRepository.save(toSave);
  }

  async remove(id: number, curentUser: User) {
    if (!(await this.canRemoveArreteCadre(id, curentUser))) {
      throw new HttpException(
        `Vous ne pouvez supprimer un arrêté cadre que si il est sur votre département et en statut brouillon.`,
        HttpStatus.FORBIDDEN,
      );
    }
    return this.arreteCadreRepository.delete(id);
  }

  async canUpdateArreteCadre(id: number, user: User): Promise<boolean> {
    const arrete = await this.findOne(id, user);
    return arrete && arrete.statut !== 'abroge';
  }

  async canRemoveArreteCadre(id: number, user: User): Promise<boolean> {
    const arrete = await this.findOne(id, user);
    return arrete && arrete.statut === 'a_valider';
  }

  /**
   * Mis à jour des statut des AC tous les jours à 2h du matin
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async updateArreteCadreStatus() {
    const acAVenir = await this.arreteCadreRepository.find({
      where: {
        statut: 'a_venir',
        // @ts-expect-error string date
        dateDebut: LessThanOrEqual(new Date()),
      },
    });
    await this.arreteCadreRepository.update(
      { id: In(acAVenir.map((ac) => ac.id)) },
      { statut: 'publie' },
    );
    this.logger.log(`${acAVenir.length} Arrêtés Cadre publiés`);

    const acPerime = await this.arreteCadreRepository.find({
      where: {
        statut: 'publie',
        // @ts-expect-error string date
        dateFin: LessThan(new Date()),
      },
    });
    await this.arreteCadreRepository.update(
      { id: In(acPerime.map((ac) => ac.id)) },
      { statut: 'abroge' },
    );
    this.logger.log(`${acPerime.length} Arrêtés Cadre abrogés`);

    // TODO : S'occuper des AR associés
  }

  /************************************************************************************ TEST FUNCTIONS ************************************************************************************/

  /**
   * Ajouts d'arrêtés cadres pour les tests E2E
   */
  async populateTestData(): Promise<void> {
    testArretesCadre.forEach(async (ac: any) => {
      await this.create(JSON.parse(JSON.stringify(ac)));
    });
    return;
  }

  /**
   * Suppression des données générées par les tests E2E
   * Par convention les données générées par les tests E2E sont préfixées par CYTEST
   */
  removeTestData(): Promise<DeleteResult> {
    return this.arreteCadreRepository.delete({ numero: Like('CYTEST%') });
  }
}
