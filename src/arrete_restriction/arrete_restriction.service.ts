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
            arreteCadre: {
              id: true,
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
          'restrictions.arreteCadre',
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
    const ar: ArreteRestriction = await this.findOne(id, currentUser);
    //@ts-expect-error type
    const arBis: ArreteRestriction = {
      ...ar,
      ...{
        dateDebut: publishArreteRestrictionDto.dateDebut,
        dateFin: publishArreteRestrictionDto,
      },
    };
    if (
      !(await this.canUpdateArreteRestriction(
        ar,
        currentUser,
        !arreteRestrictionPdf,
      )) ||
      (await this.checkBeforePublish(arBis)).errors.length > 0
    ) {
      throw new HttpException(
        `Impossible de publier l'arrête de restriction.`,
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

  async checkBeforePublish(ar: ArreteRestriction) {
    const errors = [];
    const warnings = [];
    /**
     * Check des arrêtés cadre, si un des ACs n'est pas publié, on ne peut pas publier l'AR
     */
    const maxDateDebut = new Date(
      Math.max.apply(
        null,
        ar.arretesCadre.map((ac) => new Date(ac.dateDebut).getTime()),
      ),
    );
    const minDateFin = ar.arretesCadre.some((ac) => ac.dateFin)
      ? new Date(
          Math.min.apply(
            null,
            ar.arretesCadre.map((ac) => new Date(ac.dateFin).getTime()),
          ),
        )
      : null;
    // TODO cas de l'AC gelé
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
    });
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
          id: Not(ar.id),
        },
        relations: [],
      });
    const minDateDebut = arsWithSameZonesOrCommunes.some((ar) => ar.dateDebut)
      ? new Date(
          Math.min.apply(
            null,
            arsWithSameZonesOrCommunes.map((ar) =>
              new Date(ar.dateDebut).getTime(),
            ),
          ),
        )
      : null;
    const maxDateFin = arsWithSameZonesOrCommunes.some((ar) => ar.dateFin)
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
