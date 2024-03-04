import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
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
import { ArreteCadreService } from '../arrete_cadre/arrete_cadre.service';
import { CreateUpdateArreteCadreDto } from '../arrete_cadre/dto/create_update_arrete_cadre.dto';
import { ArreteCadre } from '../arrete_cadre/entities/arrete_cadre.entity';
import { CreateUpdateArreteRestrictionDto } from './dto/create_update_arrete_restriction.dto';
import { RestrictionService } from '../restriction/restriction.service';
import { RepealArreteCadreDto } from '../arrete_cadre/dto/repeal_arrete_cadre.dto';
import { StatutArreteCadre } from '../arrete_cadre/type/arrete_cadre.type';
import { RepealArreteRestrictionDto } from './dto/repeal_arrete_restriction.dto';
import { PublishArreteCadreDto } from '../arrete_cadre/dto/publish_arrete_cadre.dto';
import { PublishArreteRestrictionDto } from './dto/publish_arrete_restriction.dto';
import { FichierService } from '../fichier/fichier.service';

@Injectable()
export class ArreteRestrictionService {
  private readonly logger = new RegleauLogger('ArreteRestrictionService');

  constructor(
    @InjectRepository(ArreteRestriction)
    private readonly arreteRestrictionRepository: Repository<ArreteRestriction>,
    private readonly departementService: DepartementService,
    @Inject(forwardRef(() => ArreteCadreService))
    private readonly arreteCadreService: ArreteCadreService,
    private readonly restrictionService: RestrictionService,
    private readonly fichierService: FichierService,
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
      departement: {
        code:
          !currentUser || currentUser.role === 'mte'
            ? depCode
            : currentUser.role_departement,
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
            disabled: true,
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
            departement: {
              code: currentUser.role_departement,
            },
          };
    const [ar, acs] = await Promise.all([
      this.arreteRestrictionRepository.findOne({
        select: {
          id: true,
          numero: true,
          dateDebut: true,
          dateFin: true,
          dateSignature: true,
          statut: true,
          niveauGraviteSpecifiqueEap: true,
          fichier: {
            id: true,
            nom: true,
            url: true,
            size: true,
          },
          restrictions: {
            id: true,
            nomGroupementAep: true,
            zoneAlerte: {
              id: true,
              code: true,
              nom: true,
              type: true,
              disabled: true,
            },
            communes: {
              id: true,
              nom: true,
              code: true,
            },
            niveauGravite: true,
            usagesArreteRestriction: {
              id: true,
              concerneParticulier: true,
              concerneEntreprise: true,
              concerneCollectivite: true,
              concerneExploitation: true,
              concerneEso: true,
              concerneEsu: true,
              concerneAep: true,
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
          departement: {
            id: true,
            code: true,
          },
          arreteRestrictionAbroge: {
            id: true,
            numero: true,
          },
        },
        relations: [
          'fichier',
          'restrictions',
          'restrictions.zoneAlerte',
          'restrictions.communes',
          'restrictions.usagesArreteRestriction',
          'restrictions.usagesArreteRestriction.usage',
          'restrictions.usagesArreteRestriction.usage.thematique',
          'departement',
          'arreteRestrictionAbroge',
        ],
        where: whereClause,
      }),
      this.arreteCadreService.findByArreteRestrictionId(id),
    ]);
    ar.arretesCadre = acs;
    return ar;
  }

  async findByArreteCadreAndDepartement(
    acId: number,
    depCode: string,
  ): Promise<ArreteRestriction[]> {
    return this.arreteRestrictionRepository.find({
      select: {
        id: true,
        statut: true,
        restrictions: {
          id: true,
          nomGroupementAep: true,
          zoneAlerte: {
            id: true,
            code: true,
            nom: true,
            type: true,
            disabled: true,
          },
          communes: {
            id: true,
            nom: true,
            code: true,
          },
        },
      },
      relations: [
        'restrictions',
        'restrictions.zoneAlerte',
        'restrictions.communes',
        'departement',
      ],
      where: {
        arretesCadre: {
          id: acId,
        },
        departement: {
          code: depCode,
        },
        statut: In(['a_venir', 'publie']),
      },
    });
  }

  async create(
    createArreteRestrictionDto: CreateUpdateArreteRestrictionDto,
    currentUser?: User,
  ): Promise<ArreteRestriction> {
    const arreteRestriction: ArreteRestriction =
      await this.arreteRestrictionRepository.save(createArreteRestrictionDto);
    arreteRestriction.restrictions =
      await this.restrictionService.updateAll(arreteRestriction);
    return arreteRestriction;
  }

  async update(
    id: number,
    updateArreteRestrictionDto: CreateUpdateArreteRestrictionDto,
    currentUser: User,
  ): Promise<ArreteRestriction> {
    const oldAr = await this.findOne(id, currentUser);
    if (!(await this.canUpdateArreteRestriction(oldAr, currentUser))) {
      throw new HttpException(
        `Vous ne pouvez éditer un arrêté de restriction que si il est sur votre département et n'est pas abrogé.`,
        HttpStatus.FORBIDDEN,
      );
    }
    // await this.checkAci(updateArreteRestrictionDto, true, currentUser);
    const arreteRestriction = await this.arreteRestrictionRepository.save({
      id,
      ...updateArreteRestrictionDto,
    });
    // @ts-expect-error dto != entity
    arreteRestriction.restrictions =
      await this.restrictionService.updateAll(arreteRestriction);
    return arreteRestriction;
  }

  async publish(
    id: number,
    arreteRestrictionPdf: Express.Multer.File,
    publishArreteRestrictionDto: PublishArreteRestrictionDto,
    currentUser: User,
  ): Promise<ArreteRestriction> {
    if (
      publishArreteRestrictionDto.dateFin &&
      new Date(publishArreteRestrictionDto.dateFin) <
        new Date(publishArreteRestrictionDto.dateDebut)
    ) {
      throw new HttpException(
        `La date de fin doit être postérieure à la date de début.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    // CHECKER URL / FILE
    const ar = await this.findOne(id, currentUser);
    if (
      !(await this.canUpdateArreteRestriction(
        ar,
        currentUser,
        !arreteRestrictionPdf,
      ))
    ) {
      return;
    }
    if (!arreteRestrictionPdf && !ar.fichier) {
      throw new HttpException(
        `Le PDF de l'arrêté de restriction est obligatoire.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    let toSave: any = {
      id,
      ...publishArreteRestrictionDto,
    };
    // Upload du PDF de l'arrêté cadre
    if (arreteRestrictionPdf) {
      if (ar.fichier) {
        await this.fichierService.deleteById(ar.fichier.id);
      }
      const newFile = await this.fichierService.create(
        arreteRestrictionPdf,
        `arrete-restriction/${ar.id}/`,
      );
      toSave.fichier = { id: newFile.id };
    }
    toSave =
      new Date(publishArreteRestrictionDto.dateDebut) <= new Date()
        ? publishArreteRestrictionDto.dateFin &&
          new Date(publishArreteRestrictionDto.dateFin) <= new Date()
          ? { ...toSave, ...{ statut: <StatutArreteCadre>'abroge' } }
          : { ...toSave, ...{ statut: <StatutArreteCadre>'publie' } }
        : { ...toSave, ...{ statut: <StatutArreteCadre>'a_venir' } };
    return await this.arreteRestrictionRepository.save(toSave);
  }

  async repeal(
    id: number,
    repealArreteRestrictionDto: RepealArreteRestrictionDto,
    currentUser: User,
  ): Promise<ArreteRestriction> {
    if (
      !(await this.canRepealArreteRestriction(
        id,
        repealArreteRestrictionDto,
        currentUser,
      ))
    ) {
      throw new HttpException(
        `Abrogation impossible.`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    let toSave = {
      id,
      ...repealArreteRestrictionDto,
    };
    if (new Date(repealArreteRestrictionDto.dateFin) <= new Date()) {
      toSave = { ...toSave, ...{ statut: <StatutArreteCadre>'abroge' } };
    }
    const toReturn = await this.arreteRestrictionRepository.save(toSave);
    // TODO si tout les AR associés à un AC sont abrogés, il faut abroger l'AC
    return toReturn;
  }

  async remove(id: number, curentUser: User) {
    if (!(await this.canRemoveArreteRestriction(id, curentUser))) {
      throw new HttpException(
        `Vous ne pouvez supprimer un arrêté de restriction que si il est sur votre département.`,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.arreteRestrictionRepository.delete(id);
    return;
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

  async canUpdateArreteRestriction(
    arreteRestriction: ArreteRestriction,
    user: User,
    containUrl: boolean = false,
  ): Promise<boolean> {
    return (
      arreteRestriction &&
      (!containUrl || !!arreteRestriction.fichier) &&
      (user.role === 'mte' ||
        (arreteRestriction.statut !== 'abroge' &&
          arreteRestriction.departement.code === user.role_departement &&
          !arreteRestriction.restrictions.some((r) => r.zoneAlerte?.disabled)))
    );
  }

  async canRemoveArreteRestriction(id: number, user: User): Promise<boolean> {
    const arrete = await this.findOne(id, user);
    /**
     * On peut supprimer un AR s'il est sur le département de l'utilisateur
     * ou si le département de l'utilisateur est le département pilote de l'AC
     * et qu'il n'est lié à aucun AR en cours ou abrogé
     */
    return (
      arrete &&
      (user.role === 'mte' ||
        (arrete.departement.code === user.role_departement &&
          ['a_valider'].includes(arrete.statut)))
    );
  }

  async canRepealArreteRestriction(
    id: number,
    repealArreteRestriction: RepealArreteRestrictionDto,
    user: User,
  ): Promise<boolean> {
    const arrete = await this.findOne(id, user);
    if (
      repealArreteRestriction.dateFin &&
      new Date(repealArreteRestriction.dateFin) < new Date(arrete.dateDebut)
    ) {
      throw new HttpException(
        `La date de fin doit être postérieure à la date de début.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return (
      arrete &&
      ['a_venir', 'publie'].includes(arrete.statut) &&
      (user.role === 'mte' || arrete.departement.code === user.role_departement)
    );
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
