import { Injectable } from '@nestjs/common';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { paginate, Paginated, PaginateQuery } from 'nestjs-paginate';

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
      filterableColumns: {},
      where: whereClause ? whereClause : null,
    });
  }

  findOne(id: number) {
    return this.arreteCadreRepository.findOne({ where: { id } });
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
