import { Injectable } from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import { paginate, Paginated, PaginateQuery } from 'nestjs-paginate';
import { FindOptionsWhere, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ArreteRestriction } from './entities/arrete_restriction.entity';
import { arreteRestrictionPaginateConfig } from './dto/arrete_restriction.dto';

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
    const paginateConfig = arreteRestrictionPaginateConfig;
    paginateConfig.where = whereClause ? whereClause : null;
    return paginate(query, this.arreteRestrictionRepository, paginateConfig);
  }
}
