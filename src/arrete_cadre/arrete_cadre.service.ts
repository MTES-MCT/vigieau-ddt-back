import { Injectable } from '@nestjs/common';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import {
  FilterOperator,
  paginate,
  Paginated,
  PaginateQuery,
} from 'nestjs-paginate';

@Injectable()
export class ArreteCadreService {
  constructor(
    @InjectRepository(ArreteCadre)
    private readonly arreteCadreRepository: Repository<ArreteCadre>,
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
    return paginate(query, this.arreteCadreRepository, {
      sortableColumns: ['dateDebut'],
      defaultSortBy: [['dateDebut', 'DESC']],
      nullSort: 'last',
      relations: ['zonesAlerte', 'departements'],
      searchableColumns: ['numero', 'departements.nom', 'departements.code'],
      filterableColumns: {
        statut: [FilterOperator.IN],
      },
      where: whereClause ? whereClause : null,
    });
  }

  findOne(id: number) {
    return this.arreteCadreRepository.findOne({
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
        usagesArreteCadre: {
          concerneParticulier: true,
          concerneEntreprise: true,
          concerneCollectivite: true,
          concerneExploitation: true,
          descriptionVigilance: true,
          descriptionAlerte: true,
          descriptionAlerteRenforcee: true,
          descriptionCrise: true,
          usage: {
            id: true,
            nom: true,
            thematique: {
              id: true,
              nom: true,
            },
          },
        },
      },
      relations: [
        'departements',
        'zonesAlerte',
        'usagesArreteCadre',
        'usagesArreteCadre.usage',
        'usagesArreteCadre.usage.thematique',
      ],
      where: { id },
    });
  }

  // create(createArreteCadreDto: CreateArreteCadreDto) {
  //   return 'This action adds a new arreteCadre';
  // }
  //
  // update(id: number, updateArreteCadreDto: UpdateArreteCadreDto) {
  //   return `This action updates a #${id} arreteCadre`;
  // }
  //
  // remove(id: number) {
  //   return `This action removes a #${id} arreteCadre`;
  // }
}
