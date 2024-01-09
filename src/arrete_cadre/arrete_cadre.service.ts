import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DeleteResult, FindOptionsWhere, Like, Repository } from 'typeorm';
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
import { UserDto } from '../user/dto/user.dto';
import { testArretesCadre } from '../core/test/data';

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
      ...this.formatArreteCadreDto(updateArreteCadreDto),
    });
    arreteCadre.usagesArreteCadre =
      await this.uageArreteCadreService.updateAll(arreteCadre);
    return arreteCadre;
  }

  async publish(id: number, currentUser: User) {
    if (!(await this.canUpdateArreteCadre(id, currentUser))) {
      return;
    }
    return;
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
    return (
      arrete &&
      (arrete.statut === 'a_valider' ||
        (arrete.statut === 'publie' && arrete.arretesRestriction.length < 1))
    );
  }

  async canRemoveArreteCadre(id: number, user: User): Promise<boolean> {
    const arrete = await this.findOne(id, user);
    return arrete && arrete.statut === 'a_valider';
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
