import { Injectable } from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import {
  FilterOperator,
  paginate,
  Paginated,
  PaginateQuery,
} from 'nestjs-paginate';
import { ArreteCadre } from '../arrete_cadre/entities/arrete_cadre.entity';
import { FindOptionsWhere, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ArreteRestriction } from './entities/arrete_restriction.entity';

@Injectable()
export class ArreteRestrictionService {
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
    return paginate(query, this.arreteRestrictionRepository, {
      sortableColumns: ['dateDebut'],
      defaultSortBy: [['dateDebut', 'DESC']],
      nullSort: 'last',
      relations: ['arretesCadre', 'arretesCadre.departements'],
      searchableColumns: [
        'numero',
        'arretesCadre.departements.nom',
        'arretesCadre.departements.code',
      ],
      filterableColumns: {
        statut: [FilterOperator.IN],
      },
      where: whereClause ? whereClause : null,
    });
  }
}
