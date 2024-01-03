import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { CreateUpdateArreteCadreDto } from './dto/create_update_arrete_cadre.dto';
import { UsageArreteCadreService } from '../usage_arrete_cadre/usage_arrete_cadre.service';
import { arreteCadrePaginateConfig } from './dto/arrete_cadre.dto';

@Injectable()
export class ArreteCadreService {
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
          id: true,
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

  async create(
    createArreteCadreDto: CreateUpdateArreteCadreDto,
  ): Promise<ArreteCadre> {
    const arreteCadre = await this.arreteCadreRepository.save(
      this.formatArreteCadreDto(createArreteCadreDto),
    );
    arreteCadre.usagesArreteCadre =
      await this.uageArreteCadreService.updateAll(arreteCadre);
    return arreteCadre;
  }

  async update(
    id: number,
    updateArreteCadreDto: CreateUpdateArreteCadreDto,
  ): Promise<ArreteCadre> {
    if (!(await this.canUpdateArreteCadre(id))) {
      throw new HttpException(
        `Edition d'un arrêté cadre interdit.`,
        HttpStatus.FORBIDDEN,
      );
    }
    const arreteCadre = await this.arreteCadreRepository.save({
      id,
      ...this.formatArreteCadreDto(updateArreteCadreDto),
    });
    arreteCadre.usagesArreteCadre =
      await this.uageArreteCadreService.updateAll(arreteCadre);
    return arreteCadre;
  }

  async publish(id: number) {
    if (!(await this.canUpdateArreteCadre(id))) {
      return;
    }
    return;
  }

  async remove(curentUser: User, id: number) {
    if (!(await this.canUpdateArreteCadre(id))) {
      throw new HttpException(
        `Suppression d'un arrêté cadre interdit.`,
        HttpStatus.FORBIDDEN,
      );
    }
    return this.arreteCadreRepository.delete(id);
  }

  async canUpdateArreteCadre(id: number): Promise<boolean> {
    const arrete = await this.findOne(id);
    return arrete.statut === 'a_valider';
  }

  formatArreteCadreDto(
    arreteCadreDto: CreateUpdateArreteCadreDto,
  ): ArreteCadre {
    arreteCadreDto.dateDebut =
      arreteCadreDto.dateDebut === '' ? null : arreteCadreDto.dateDebut;
    arreteCadreDto.dateFin =
      arreteCadreDto.dateFin === '' ? null : arreteCadreDto.dateFin;
    return <ArreteCadre>arreteCadreDto;
  }
}
