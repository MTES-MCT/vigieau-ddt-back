import { Injectable } from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import { paginate, Paginated, PaginateQuery } from 'nestjs-paginate';
import {
  FindOptionsWhere,
  In,
  LessThan,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ArreteRestriction } from './entities/arrete_restriction.entity';
import { arreteRestrictionPaginateConfig } from './dto/arrete_restriction.dto';
import { RegleauLogger } from '../logger/regleau.logger';

@Injectable()
export class ArreteRestrictionService {
  private readonly logger = new RegleauLogger('ArreteRestrictionService');

  constructor(
    @InjectRepository(ArreteRestriction)
    private readonly arreteRestrictionRepository: Repository<ArreteRestriction>,
  ) {}

  findAll(
    curentUser: User,
    query: PaginateQuery,
  ): Promise<Paginated<ArreteRestriction>> {
    const whereClause: FindOptionsWhere<ArreteRestriction> | null =
      curentUser.role === 'mte'
        ? null
        : {
            arretesCadre: {
              departements: {
                code: curentUser.role_departement,
              },
            },
          };
    const paginateConfig = arreteRestrictionPaginateConfig;
    paginateConfig.where = whereClause ? whereClause : null;
    return paginate(query, this.arreteRestrictionRepository, paginateConfig);
  }

  /**
   * Mis à jour des statuts des AR en fonction de ceux des ACs
   * On reprend tout pour éviter que certains AR soient passés entre les mailles du filet (notamment l'historique ou autre)
   */
  async updateArreteRestrictionStatut() {
    const arAVenir = await this.arreteRestrictionRepository.find({
      where: {
        statut: 'a_venir',
        // @ts-expect-error string date
        dateDebut: LessThanOrEqual(new Date()),
        arretesCadre: {
          statut: 'publie',
        },
      },
    });
    await this.arreteRestrictionRepository.update(
      { id: In(arAVenir.map((ar) => ar.id)) },
      { statut: 'publie' },
    );
    this.logger.log(`${arAVenir.length} Arrêtés Restriction publiés`);

    const arPerime = await this.arreteRestrictionRepository.find({
      where: [
        {
          statut: In(['a_venir', 'publie']),
          // @ts-expect-error string date
          dateFin: LessThan(new Date()),
        },
        {
          statut: In(['a_venir', 'publie']),
          arretesCadre: {
            statut: 'abroge',
          },
        },
      ],
    });
    await this.arreteRestrictionRepository.update(
      { id: In(arPerime.map((ar) => ar.id)) },
      { statut: 'abroge' },
    );
    this.logger.log(`${arPerime.length} Arrêtés Restriction abrogés`);
  }
}
