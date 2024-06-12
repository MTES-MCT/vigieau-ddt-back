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
  LessThanOrEqual, MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ArreteRestriction } from './entities/arrete_restriction.entity';
import { arreteRestrictionPaginateConfig } from './dto/arrete_restriction.dto';
import { RegleauLogger } from '../logger/regleau.logger';
import { DepartementService } from '../departement/departement.service';
import { ArreteCadreService } from '../arrete_cadre/arrete_cadre.service';
import { CreateUpdateArreteRestrictionDto } from './dto/create_update_arrete_restriction.dto';
import { RestrictionService } from '../restriction/restriction.service';
import { StatutArreteCadre } from '../arrete_cadre/type/arrete_cadre.type';
import { RepealArreteRestrictionDto } from './dto/repeal_arrete_restriction.dto';
import { PublishArreteRestrictionDto } from './dto/publish_arrete_restriction.dto';
import { FichierService } from '../fichier/fichier.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserService } from '../user/user.service';
import { MailService } from '../shared/services/mail.service';
import { ZoneAlerteComputedService } from '../zone_alerte_computed/zone_alerte_computed.service';
import { Departement } from '../departement/entities/departement.entity';
import moment, { Moment } from 'moment';
import { StatisticDepartementService } from '../statistic_departement/statistic_departement.service';

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
    private readonly userService: UserService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => ZoneAlerteComputedService))
    private readonly zoneAlerteComputedService: ZoneAlerteComputedService,
    private readonly statisticDepartementService: StatisticDepartementService,
  ) {
  }

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

  async findDatagouv() {
    return this.arreteRestrictionRepository.find({
      select: {
        id: true,
        numero: true,
        dateDebut: true,
        dateFin: true,
        dateSignature: true,
        statut: true,
        fichier: {
          url: true,
        },
        departement: {
          code: true,
        },
        arretesCadre: {
          id: true,
          numero: true,
          fichier: {
            url: true,
          },
        },
      },
      relations: [
        'fichier',
        'departement',
        'arretesCadre',
        'arretesCadre.fichier',
      ],
      where: {
        statut: In(['a_venir', 'publie', 'abroge']),
      },
      order: {
        dateDebut: 'ASC'
      }
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
          ressourceEapCommunique: true,
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
            arreteCadre: {
              id: true,
            },
            communes: {
              id: true,
              nom: true,
              code: true,
            },
            niveauGravite: true,
            usages: {
              id: true,
              nom: true,
              thematique: {
                id: true,
                nom: true,
              },
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
            },
          },
          departement: {
            id: true,
            code: true,
          },
          arreteRestrictionAbroge: {
            id: true,
            numero: true,
            dateDebut: true,
            dateFin: true,
          },
        },
        relations: [
          'fichier',
          'restrictions',
          'restrictions.zoneAlerte',
          'restrictions.arreteCadre',
          'restrictions.communes',
          'restrictions.usages',
          'restrictions.usages.thematique',
          'departement',
          'arreteRestrictionAbroge',
        ],
        where: whereClause,
        order: {
          restrictions: {
            zoneAlerte: {
              code: 'ASC',
            },
            nomGroupementAep: 'ASC',
            usages: {
              nom: 'ASC',
            },
            communes: {
              code: 'ASC',
            },
          },
        },
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
        numero: true,
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
          arreteCadre: {
            id: true,
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
        'restrictions.arreteCadre',
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

  async findByDepartement(
    depCode: string,
  ): Promise<ArreteRestriction[]> {
    return this.arreteRestrictionRepository.find({
      select: {
        id: true,
        numero: true,
        statut: true,
        niveauGraviteSpecifiqueEap: true,
        ressourceEapCommunique: true,
        restrictions: {
          id: true,
          nomGroupementAep: true,
          niveauGravite: true,
          zoneAlerte: {
            id: true,
            code: true,
            nom: true,
            type: true,
            disabled: true,
          },
          arreteCadre: {
            id: true,
          },
          communes: {
            id: true,
            nom: true,
            code: true,
          },
        },
        departement: {
          id: true,
          code: true,
          nom: true,
        },
      },
      relations: [
        'restrictions',
        'restrictions.zoneAlerte',
        'restrictions.zonesAlerteComputed',
        'restrictions.arreteCadre',
        'restrictions.communes',
        'departement',
      ],
      where: {
        departement: {
          code: depCode,
        },
        statut: In(['publie']),
      },
    });
  }

  async findByDepartementAndDate(
    depCode: string,
    date: Moment,
  ): Promise<ArreteRestriction[]> {
    return this.arreteRestrictionRepository.find({
      select: {
        id: true,
        numero: true,
        statut: true,
        niveauGraviteSpecifiqueEap: true,
        ressourceEapCommunique: true,
        restrictions: {
          id: true,
          nomGroupementAep: true,
          niveauGravite: true,
          zoneAlerte: {
            id: true,
            code: true,
            nom: true,
            type: true,
            disabled: true,
          },
          arreteCadre: {
            id: true,
          },
          communes: {
            id: true,
            nom: true,
            code: true,
          },
        },
        departement: {
          id: true,
          code: true,
          nom: true,
        },
      },
      relations: [
        'restrictions',
        'restrictions.zoneAlerte',
        'restrictions.zonesAlerteComputed',
        'restrictions.arreteCadre',
        'restrictions.communes',
        'departement',
      ],
      where: {
        departement: {
          code: depCode,
        },
        statut: In(['publie', 'abroge']),
        dateDebut: LessThanOrEqual(date.format('YYYY-MM-DD')),
        dateFin: MoreThanOrEqual(date.format('YYYY-MM-DD')),
      },
    });
  }

  async findByDate(date: Moment) {
    return this.arreteRestrictionRepository.find({
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
        },
        departement: {
          code: true,
        },
        arretesCadre: {
          id: true,
          numero: true,
          fichier: {
            url: true,
          },
        },
      },
      relations: [
        'fichier',
        'departement',
        'arretesCadre',
        'arretesCadre.fichier',
      ],
      where: {
        statut: In(['publie', 'abroge']),
        dateDebut: LessThanOrEqual(date.format('YYYY-MM-DD')),
        dateFin: MoreThanOrEqual(date.format('YYYY-MM-DD')),
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
      await this.restrictionService.updateAll(createArreteRestrictionDto, arreteRestriction.id);
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
    const arreteRestriction: ArreteRestriction =
      await this.arreteRestrictionRepository.save({
        id,
        ...updateArreteRestrictionDto,
      });
    arreteRestriction.restrictions =
      await this.restrictionService.updateAll(updateArreteRestrictionDto, arreteRestriction.id);
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
      moment(publishArreteRestrictionDto.dateFin)
        .isBefore(publishArreteRestrictionDto.dateDebut, 'day')
    ) {
      throw new HttpException(
        `La date de fin doit être postérieure à la date de début.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    // CHECKER URL / FILE
    const ar: ArreteRestriction = await this.findOne(id, currentUser);
    //@ts-expect-error type
    const arBis: ArreteRestriction = {
      ...ar,
      ...{
        dateDebut: publishArreteRestrictionDto.dateDebut,
        dateFin: publishArreteRestrictionDto.dateFin,
      },
    };
    if (
      !(await this.canUpdateArreteRestriction(
        ar,
        currentUser,
        !arreteRestrictionPdf,
      ))
    ) {
      throw new HttpException(
        `Impossible de publier l'arrête de restriction.`,
        HttpStatus.FORBIDDEN,
      );
    }
    const checkReturn = await this.checkBeforePublish(arBis);
    if (checkReturn.errors.length > 0) {
      throw new HttpException(
        `Impossible de publier l'arrête de restriction.\n${checkReturn.errors.join('\n')}`,
        HttpStatus.FORBIDDEN,
      );
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
        await this.arreteRestrictionRepository.update({ id: id }, { fichier: null });
        await this.fichierService.deleteById(ar.fichier.id);
      }
      const newFile = await this.fichierService.create(
        arreteRestrictionPdf,
        `arrete-restriction/${ar.id}/`,
      );
      toSave.fichier = { id: newFile.id };
    }
    toSave =
      moment(publishArreteRestrictionDto.dateDebut).isSameOrBefore(moment(), 'day')
        ? publishArreteRestrictionDto.dateFin &&
        moment(publishArreteRestrictionDto.dateFin).isBefore(moment(), 'day')
          ? { ...toSave, ...{ statut: <StatutArreteCadre>'abroge' } }
          : { ...toSave, ...{ statut: <StatutArreteCadre>'publie' } }
        : { ...toSave, ...{ statut: <StatutArreteCadre>'a_venir' } };
    const toRerturn = await this.arreteRestrictionRepository.save(toSave);

    // Gestion des abrogations associées
    if (ar.arreteRestrictionAbroge) {
      const dateDebutAr = new Date(publishArreteRestrictionDto.dateDebut);
      const dateFinArAbroge = ar.arreteRestrictionAbroge.dateFin ? new Date(ar.arreteRestrictionAbroge.dateFin) : null;
      if (
        !dateFinArAbroge ||
        moment(dateFinArAbroge).isSameOrAfter(moment(dateDebutAr), 'day')
      ) {
        const dateToSave = dateDebutAr;
        dateToSave.setDate(dateToSave.getDate() - 1);
        await this.arreteRestrictionRepository.update(
          {
            id: ar.arreteRestrictionAbroge.id,
          },
          {
            dateFin: dateToSave.toDateString(),
          },
        );
      }
    }
    await this.updateArreteRestrictionStatut([ar.departement]);
    return toRerturn;
  }

  async repeal(
    id: number,
    repealArreteRestrictionDto: RepealArreteRestrictionDto,
    currentUser: User,
  ): Promise<ArreteRestriction> {
    const ar = await this.findOne(id, currentUser);
    if (
      !(await this.canRepealArreteRestriction(
        ar,
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
    if (moment(repealArreteRestrictionDto.dateFin).isBefore(moment(), 'day')) {
      toSave = { ...toSave, ...{ statut: <StatutArreteCadre>'abroge' } };
    }
    const toReturn = await this.arreteRestrictionRepository.save(toSave);
    await this.updateArreteRestrictionStatut([ar.departement]);
    // TODO si tout les AR associés à un AC sont abrogés, il faut abroger l'AC
    return toReturn;
  }

  async checkBeforePublish(ar: ArreteRestriction) {
    const errors = [];
    const warnings = [];
    /**
     * Check des arrêtés cadre, si un des ACs n'est pas publié, on ne peut pas publier l'AR
     */
    const maxDateDebut = new Date(
      Math.max.apply(
        null,
        ar.arretesCadre.map((ac) =>
          ac.dateDebut ?
            new Date(ac.dateDebut).getTime() : null,
        ),
      ),
    );
    const minDateFin = ar.arretesCadre.some((ac) => ac.dateFin)
      ? new Date(
        Math.min.apply(
          null,
          ar.arretesCadre.map((ac) =>
            ac.dateFin ?
              new Date(ac.dateFin).getTime() : null),
        ),
      )
      : null;
    ar.arretesCadre.forEach((ac) => {
      switch (ac.statut) {
        case 'a_valider':
          errors.push(
            `L'arrête cadre ${ac.numero} est en brouillon, il n'est pas possible de publier un AR dessus.`,
          );
          break;
        case 'abroge':
          errors.push(
            `L'arrête cadre ${ac.numero} est abrogé, il n'est pas possible de publier un AR dessus.`,
          );
          break;
      }
      if (ac.zonesAlerte.some(za => za.disabled)) {
        errors.push(
          `L'arrête cadre ${ac.numero} est gelé, il contient des zones qui ne sont plus à jour.`,
        );
      }
    });
    const acFreeze = ar.arretesCadre.find((ac) => ac.zonesAlerte.some(z => z.disabled));
    if (acFreeze) {
      errors.push(
        `L'arrête cadre ${acFreeze.numero} est gelé, il n'est pas possible de publier un AR dessus.`,
      );
    }
    if (
      ar.arretesCadre.some((ac) => ['a_venir', 'publie'].includes(ac.statut))
    ) {
      // Check des dates (un AR doit avoir ses dates incluses dans celle de l'AC)
      warnings.push(
        `Pour respecter les dates des arrêtés cadre associés, l'arrêté de restriction doit commencer à partir du ${maxDateDebut.toLocaleDateString('fr')}${minDateFin ? 'et terminer avant le ' + minDateFin.toLocaleDateString('fr') + '.' : '.'}`,
      );
      if (
        new Date(ar.dateDebut).getTime() < maxDateDebut.getTime() ||
        (minDateFin && new Date(ar.dateDebut).getTime() > minDateFin.getTime())
      ) {
        if (minDateFin) {
          errors.push(
            `Pour respecter les dates des arrêtés cadre associés, la date de début de l'arrêté de restriction doit être comprise entre le ${maxDateDebut.toLocaleDateString('fr')} et le ${minDateFin.toLocaleDateString('fr')}.`,
          );
        } else {
          errors.push(
            `Pour respecter les dates des arrêtés cadre associés, l'arrêté de restriction doit commencer à partir du ${maxDateDebut.toLocaleDateString('fr')}.`,
          );
        }
      }
      // Check date AR abrogé
      if (ar.arreteRestrictionAbroge) {
        const dateDebutAr = new Date(ar.dateDebut);
        const dateDebutArAbroge = new Date(ar.arreteRestrictionAbroge.dateDebut);
        if (dateDebutAr.getTime() <= dateDebutArAbroge.getTime()) {
          errors.push(
            `La date de début de l'arrêté de restriction doit être supérieur à celle de l'arrêté de restriction abrogé.`,
          );
        }
      }
      if (
        ar.dateFin &&
        minDateFin &&
        new Date(ar.dateFin).getTime() > minDateFin.getTime()
      ) {
        errors.push(
          `Pour respecter les dates des arrêtés cadre associés, la date de fin de l'arrêté de restriction doit être antérieur au ${minDateFin.toLocaleDateString('fr')}.`,
        );
      }
    }
    if (ar.restrictions.length < 1) {
      errors.push(
        `L'arrête de restriction doit contenir au minimum une zone (ESO / ESU ou AEP).`,
      );
    }
    const zonesId = ar.restrictions
      .filter((r) => !!r.zoneAlerte)
      .map((r) => r.zoneAlerte.id);
    const communesId = ar.restrictions
      .filter((r) => !r.zoneAlerte)
      .map((r) => r.communes)
      .flat()
      .map((c) => c.id);
    const idsExcluded = [ar.id];
    if (ar.arreteRestrictionAbroge) {
      idsExcluded.push(ar.arreteRestrictionAbroge.id);
    }
    const arsWithSameZonesOrCommunes =
      await this.arreteRestrictionRepository.find({
        select: {
          id: true,
          numero: true,
          dateDebut: true,
          dateFin: true,
          statut: true,
        },
        where: {
          restrictions: [
            { zoneAlerte: { id: In(zonesId) } },
            { communes: { id: In(communesId) } },
          ],
          statut: In(['a_venir', 'publie']),
          id: Not(In(idsExcluded)),
        },
        relations: [],
      });
    const minDateDebut = arsWithSameZonesOrCommunes
      .some((ar) => ar.dateDebut)
      ? new Date(
        Math.min.apply(
          null,
          arsWithSameZonesOrCommunes.map((ar) =>
            new Date(ar.dateDebut).getTime(),
          ),
        ),
      )
      : null;
    const maxDateFin = arsWithSameZonesOrCommunes
      .some((ar) => ar.dateFin)
      ? new Date(
        Math.max.apply(
          null,
          arsWithSameZonesOrCommunes.map((ar) =>
            new Date(ar.dateFin).getTime(),
          ),
        ),
      )
      : null;
    if (arsWithSameZonesOrCommunes.length > 0) {
      let message = `D'autres arrêtés de restrictions sont à venir ou en vigueur sur des zones ou communes similaires (${arsWithSameZonesOrCommunes.map((ar) => ar.numero).join(', ')}).`;
      if (minDateDebut) {
        message += ` Votre arrêté de restriction doit terminer avant le ${minDateDebut.toLocaleDateString('fr')}`;
      }
      if (maxDateFin) {
        message += ` ou commencer après le ${maxDateFin.toLocaleDateString('fr')}`;
      }
      if (minDateDebut) {
        message += ` afin de ne pas chevaucher les autres arrêtés de restrictions.`;
      }
      warnings.push(message);
      if (
        (ar.dateDebut &&
          new Date(ar.dateDebut).getTime() >= minDateDebut.getTime() &&
          (!maxDateFin ||
            new Date(ar.dateDebut).getTime() <= maxDateFin.getTime())) ||
        (ar.dateFin &&
          new Date(ar.dateFin).getTime() >= minDateDebut.getTime() &&
          (!maxDateFin ||
            new Date(ar.dateFin).getTime() <= maxDateFin.getTime())) ||
        (ar.dateDebut &&
          ar.dateFin &&
          new Date(ar.dateDebut).getTime() < minDateDebut.getTime() &&
          new Date(ar.dateFin).getTime() > maxDateFin.getTime())
      ) {
        errors.push(message);
      }
    }
    return {
      errors,
      warnings,
    };
  }

  async remove(id: number, curentUser: User) {
    const arrete = await this.findOne(id, curentUser);
    if (!(await this.canRemoveArreteRestriction(arrete, curentUser))) {
      throw new HttpException(
        `Vous ne pouvez supprimer un arrêté de restriction que si il est sur votre département.`,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.arreteRestrictionRepository.delete(id);
    if (arrete.statut === 'publie') {
      this.zoneAlerteComputedService.askCompute([arrete.departement.id]);
      this.statisticDepartementService.computeDepartementStatistics();
    }
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

  async canRemoveArreteRestriction(arrete: ArreteRestriction, user: User): Promise<boolean> {
    /**
     * On peut supprimer un AR s'il est sur le département de l'utilisateur
     * ou que l'utilisateur a un rôle MTE
     */
    return (
      arrete &&
      (user.role === 'mte' ||
        (arrete.departement.code === user.role_departement &&
          ['a_valider'].includes(arrete.statut)))
    );
  }

  async canRepealArreteRestriction(
    arrete: ArreteRestriction,
    repealArreteRestriction: RepealArreteRestrictionDto,
    user: User,
  ): Promise<boolean> {
    if (
      repealArreteRestriction.dateFin &&
      moment(repealArreteRestriction.dateFin)
        .isBefore(moment(arrete.dateDebut), 'day')
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
  async updateArreteRestrictionStatut(departements?: Departement[]) {
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

    const arPerime: ArreteRestriction[] = await this.arreteRestrictionRepository.find({
      select: {
        id: true,
        dateDebut: true,
        dateFin: true,
        arretesCadre: {
          id: true,
          statut: true,
          dateFin: true,
        },
      },
      relations: ['arretesCadre'],
      where: [
        {
          statut: In(['a_venir', 'publie']),
          // @ts-expect-error string date
          dateFin: LessThan(moment().startOf('day')),
        },
        {
          statut: In(['a_venir', 'publie']),
          arretesCadre: {
            statut: 'abroge',
          },
        },
      ],
    });
    const promises = [];
    arPerime.forEach(ar => {
      const arDateFin = new Date(ar.dateFin);
      const arDateDebut = new Date(ar.dateDebut);
      const acDateFin = new Date(Math.min.apply(null, ar.arretesCadre
        .filter(ac => ac.statut === 'abroge')
        .map(ac => new Date(ac.dateFin))));
      if ((!ar.dateFin && acDateFin) || (ar.dateFin && acDateFin && arDateFin.getTime() > acDateFin.getTime())) {
        promises.push(this.arreteRestrictionRepository.update(
          { id: ar.id },
          // @ts-ignore
          { dateFin: acDateFin },
        ));
        if (acDateFin.getTime() < arDateDebut.getTime()) {
          promises.push(this.arreteRestrictionRepository.update(
            { id: ar.id },
            // @ts-ignore
            { dateDebut: acDateFin },
          ));
        }
      }
    });
    promises.push(this.arreteRestrictionRepository.update(
      { id: In(arPerime.map((ar) => ar.id)) },
      { statut: 'abroge' },
    ));
    await Promise.all(promises);
    this.logger.log(`${arPerime.length} Arrêtés Restriction abrogés`);
    this.zoneAlerteComputedService.askCompute(departements ? departements.map(d => d.id) : []);
    this.statisticDepartementService.computeDepartementStatistics();
  }

  /**
   * Vérification s'il faut envoyer des mails de relance tous les jours à 8h du matin
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendArreteRestrictionEmails() {
    const [ar15ARelancer, ar2ARelancer] = await Promise.all([
      this.getArAtXDays(15),
      this.getArAtXDays(2),
    ]);
    for (const ar of ar15ARelancer.concat(ar2ARelancer)) {
      const usersToSendMail = await this.userService.findByDepartementsId([
        ar.departement.id,
      ]);
      const nbJoursFin = ar15ARelancer.some((a) => a.id === ar.id) ? 15 : 2;
      await this.mailService.sendEmails(
        usersToSendMail.map((u) => u.email),
        `L'arrêté ${ar.numero} se termine dans ${nbJoursFin} jours`,
        'relance_arrete',
        {
          arreteNumero: ar.numero,
          arreteDateFin: ar.dateFin,
          joursFin: nbJoursFin,
          isAc: false,
          isAr: true,
          arreteLien: `https://${process.env.DOMAIN_NAME}/arrete-restriction/${ar.id}/edition`,
        },
      );
    }

    const arARelancer = await this.getArByMonth();
    for (const ar of arARelancer) {
      const usersToSendMail = await this.userService.findByDepartementsId([
        ar.departement.id,
      ]);
      const nbMonths =
        new Date().getMonth() -
        new Date(ar.dateDebut).getMonth() +
        12 * (new Date().getFullYear() - new Date(ar.dateDebut).getFullYear());
      await this.mailService.sendEmails(
        usersToSendMail.map((u) => u.email),
        `L'arrêté ${ar.numero} est actif depuis ${nbMonths} mois`,
        'relance_arrete',
        {
          arreteNumero: ar.numero,
          arreteDateDebut: ar.dateDebut,
          arreteDateFin: ar.dateFin,
          nbMonths: nbMonths,
          arreteLien: `https://${process.env.DOMAIN_NAME}/arrete-restriction/${ar.id}/edition`,
        },
      );
    }
  }

  private getArAtXDays(days: number) {
    return this.arreteRestrictionRepository
      .createQueryBuilder('arrete_restriction')
      .leftJoinAndSelect('arrete_restriction.departement', 'departement')
      .where('arrete_restriction.statut IN (:...statuts)', {
        statuts: ['a_venir', 'publie'],
      })
      .having(
        `DATE_PART('day', "dateFin"::timestamp - CURRENT_DATE::timestamp) = ${days}`,
      )
      .groupBy('arrete_restriction.id')
      .addGroupBy('departement.id')
      .getMany();
  }

  private getArByMonth() {
    return this.arreteRestrictionRepository
      .createQueryBuilder('arrete_restriction')
      .leftJoinAndSelect('arrete_restriction.departement', 'departement')
      .where('arrete_restriction.statut IN (:...statuts)', {
        statuts: ['publie'],
      })
      .andWhere(
        `DATE_PART('day', "dateDebut"::timestamp) = DATE_PART('day', current_date)`,
      )
      .having(
        `DATE_PART('day', CURRENT_DATE::timestamp - "dateDebut"::timestamp) > 27`,
      )
      .groupBy('arrete_restriction.id')
      .addGroupBy('departement.id')
      .getMany();
  }
}
