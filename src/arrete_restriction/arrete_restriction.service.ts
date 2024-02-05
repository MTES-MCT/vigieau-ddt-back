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
import { DepartementService } from '../departement/departement.service';

@Injectable()
export class ArreteRestrictionService {
  private readonly logger = new RegleauLogger('ArreteRestrictionService');

  constructor(
    @InjectRepository(ArreteRestriction)
    private readonly arreteRestrictionRepository: Repository<ArreteRestriction>,
    private readonly departementService: DepartementService,
  ) {}

  async findAll(query: PaginateQuery): Promise<Paginated<ArreteRestriction>> {
    const paginateConfig = arreteRestrictionPaginateConfig;
    const paginateToReturn = await paginate(
      query,
      this.arreteRestrictionRepository,
      paginateConfig,
    );

    // Récupérer tous les départements, car on filtre sur les départements
    await Promise.all(
      paginateToReturn.data.map(async (ar) => {
        await Promise.all(
          ar.arretesCadre.map(async (ac) => {
            ac.departements = await this.departementService.findByArreteCadreId(
              ac.id,
            );
            return ac;
          }),
        );
        return ar;
      }),
    );

    return paginateToReturn;
  }

  async find(
    currentUser?: User,
    depCode?: string,
  ): Promise<ArreteRestriction[]> {
    const whereClause: FindOptionsWhere<ArreteRestriction> | null = {
      statut: In(['a_venir', 'publie']),
      arretesCadre: {
        zonesAlerte: {
          departement: {
            code:
              !currentUser || currentUser.role === 'mte'
                ? depCode
                : currentUser.role_departement,
          },
        },
      },
    };
    return this.arreteRestrictionRepository.find({
      select: {
        id: true,
        numero: true,
        dateDebut: true,
        dateFin: true,
        dateSignature: true,
        statut: true,
        arretesCadre: {
          id: true,
          numero: true,
          statut: true,
          zonesAlerte: {
            id: true,
            code: true,
            nom: true,
            type: true,
            departement: {
              id: true,
              code: true,
              nom: true,
            },
          },
        },
      },
      relations: [
        'arretesCadre',
        'arretesCadre.zonesAlerte',
        'arretesCadre.zonesAlerte.departement',
      ],
      where: whereClause,
    });
  }

  async findOne(id: number, currentUser?: User) {
    const whereClause: FindOptionsWhere<ArreteRestriction> | null =
      !currentUser || currentUser.role === 'mte'
        ? { id }
        : {
            id,
            arretesCadre: {
              zonesAlerte: {
                departement: {
                  code: currentUser.role_departement,
                },
              },
            },
          };
    return this.arreteRestrictionRepository.findOne({
      select: {
        id: true,
        numero: true,
        dateDebut: true,
        dateFin: true,
        dateSignature: true,
        statut: true,
        fichier: {
          id: true,
          nom: true,
          url: true,
          size: true,
        },
        arretesCadre: {
          id: true,
          numero: true,
          statut: true,
          zonesAlerte: {
            id: true,
            code: true,
            nom: true,
            type: true,
            departement: {
              id: true,
              code: true,
              nom: true,
            },
          },
        },
        restrictions: {
          id: true,
          zoneAlerte: {
            id: true,
            code: true,
            nom: true,
            type: true,
          },
          niveauGravite: true,
        },
        departement: {
          id: true,
        },
      },
      relations: [
        'fichier',
        'arretesCadre',
        'arretesCadre.zonesAlerte',
        'arretesCadre.zonesAlerte.departement',
        'restrictions',
        'restrictions.zoneAlerte',
        'departement',
      ],
      where: whereClause,
    });
  }

  async deleteByArreteCadreId(acId: number) {
    const arIds = await this.arreteRestrictionRepository
      .createQueryBuilder('arreteRestriction')
      .select('arreteRestriction.id')
      .leftJoin('arreteRestriction.arretesCadre', 'arretesCadre')
      .where('arretesCadre.id = :acId', { acId: acId })
      .getMany();
    return this.arreteRestrictionRepository.delete({
      id: In(arIds.map((ar) => ar.id)),
    });
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
