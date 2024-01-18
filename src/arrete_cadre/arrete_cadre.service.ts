import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  DeleteResult,
  FindOptionsWhere,
  In,
  LessThan,
  LessThanOrEqual,
  Like,
  Repository,
} from 'typeorm';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { paginate, Paginated, PaginateQuery } from 'nestjs-paginate';
import { CreateUpdateArreteCadreDto } from './dto/create_update_arrete_cadre.dto';
import { UsageArreteCadreService } from '../usage_arrete_cadre/usage_arrete_cadre.service';
import { arreteCadrePaginateConfig } from './dto/arrete_cadre.dto';
import { testArretesCadre } from '../core/test/data';
import { PublishArreteCadreDto } from './dto/publish_arrete_cadre.dto';
import { StatutArreteCadre } from './type/arrete_cadre.type';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RegleauLogger } from '../logger/regleau.logger';
import { RepealArreteCadreDto } from './dto/repeal_arrete_cadre.dto';
import { ArreteRestrictionService } from '../arrete_restriction/arrete_restriction.service';
import { S3Service } from '../shared/services/s3.service';
import { DepartementService } from '../departement/departement.service';
import { ZoneAlerteService } from '../zone_alerte/zone_alerte.service';
import { MailService } from '../shared/services/mail.service';
import { UserService } from '../user/user.service';

@Injectable()
export class ArreteCadreService {
  private readonly logger = new RegleauLogger('ArreteCadreService');

  constructor(
    @InjectRepository(ArreteCadre)
    private readonly arreteCadreRepository: Repository<ArreteCadre>,
    private readonly uageArreteCadreService: UsageArreteCadreService,
    private readonly arreteRestrictionService: ArreteRestrictionService,
    private readonly s3Service: S3Service,
    private readonly departementService: DepartementService,
    private readonly zoneAlerteService: ZoneAlerteService,
    private readonly mailService: MailService,
    private readonly userService: UserService,
  ) {}

  async findAll(
    curentUser: User,
    query: PaginateQuery,
  ): Promise<Paginated<ArreteCadre>> {
    const whereClause: FindOptionsWhere<ArreteCadre> | null =
      curentUser.role === 'mte'
        ? null
        : {
            departements: {
              code: curentUser.role_departement,
            },
          };
    const paginateConfig = arreteCadrePaginateConfig;
    paginateConfig.where = whereClause ? whereClause : null;
    const paginateToReturn = await paginate(
      query,
      this.arreteCadreRepository,
      paginateConfig,
    );

    // Récupérer tous les départements, car on filtre sur les départements
    if (whereClause) {
      const departements = await Promise.all(
        paginateToReturn.data.map((ac) => {
          return this.departementService.findByArreteCadreId(ac.id);
        }),
      );
      paginateToReturn.data.forEach((ac, index) => {
        ac.departements = departements[index];
      });
    }

    return paginateToReturn;
  }

  async findOne(id: number, curentUser?: User) {
    const whereClause: FindOptionsWhere<ArreteCadre> | null =
      !curentUser || curentUser.role === 'mte'
        ? { id }
        : {
            id,
            departements: {
              code: curentUser.role_departement,
            },
          };
    const [arreteCadre, usagesArreteCadre, departements] = await Promise.all([
      this.arreteCadreRepository.findOne({
        select: {
          id: true,
          numero: true,
          dateDebut: true,
          dateFin: true,
          url: true,
          urlDdt: true,
          statut: true,
          communeNiveauGraviteMax: true,
          departementPilote: {
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
            numero: true,
            statut: true,
          },
        },
        relations: ['departementPilote', 'zonesAlerte', 'arretesRestriction'],
        where: whereClause,
      }),
      this.uageArreteCadreService.findByArreteCadre(id),
      this.departementService.findByArreteCadreId(id),
    ]);
    if (arreteCadre) {
      arreteCadre.usagesArreteCadre = usagesArreteCadre;
    }
    if (departements) {
      arreteCadre.departements = departements;
    }
    return arreteCadre;
  }

  async create(
    createArreteCadreDto: CreateUpdateArreteCadreDto,
    currentUser?: User,
  ): Promise<ArreteCadre> {
    // Check ACI
    await this.checkAci(createArreteCadreDto, currentUser, false);
    const arreteCadre =
      await this.arreteCadreRepository.save(createArreteCadreDto);
    arreteCadre.usagesArreteCadre =
      await this.uageArreteCadreService.updateAll(arreteCadre);
    this.sendAciMails(null, arreteCadre, currentUser);
    return arreteCadre;
  }

  async update(
    id: number,
    updateArreteCadreDto: CreateUpdateArreteCadreDto,
    currentUser: User,
  ): Promise<ArreteCadre> {
    const oldAc = await this.findOne(id, currentUser);
    if (!(await this.canUpdateArreteCadre(oldAc, currentUser))) {
      throw new HttpException(
        `Vous ne pouvez éditer un arrêté cadre que si il est sur votre département et n'est pas abrogé.`,
        HttpStatus.FORBIDDEN,
      );
    }
    await this.checkAci(updateArreteCadreDto, currentUser, true);
    const arreteCadre = await this.arreteCadreRepository.save({
      id,
      ...updateArreteCadreDto,
    });
    arreteCadre.usagesArreteCadre =
      await this.uageArreteCadreService.updateAll(arreteCadre);
    this.sendAciMails(oldAc, arreteCadre, currentUser);
    return arreteCadre;
  }

  async publish(
    id: number,
    arreteCadrePdf: Express.Multer.File,
    publishArreteCadreDto: PublishArreteCadreDto,
    currentUser: User,
  ): Promise<ArreteCadre> {
    if (
      publishArreteCadreDto.dateFin &&
      new Date(publishArreteCadreDto.dateFin) <
        new Date(publishArreteCadreDto.dateDebut)
    ) {
      throw new HttpException(
        `La date de fin doit être postérieure à la date de début.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    // CHECKER URL / FILE
    const ac = await this.findOne(id, currentUser);
    if (!(await this.canUpdateArreteCadre(ac, currentUser, !arreteCadrePdf))) {
      return;
    }
    if (!arreteCadrePdf && !ac.url) {
      throw new HttpException(
        `Le PDF de l'arrêté cadre est obligatoire.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    let toSave: any = {
      id,
      ...publishArreteCadreDto,
    };
    // Upload du PDF de l'arrêté cadre
    if (arreteCadrePdf) {
      if (ac.url) {
        await this.s3Service.deleteFile(ac.url);
      }
      const s3Response = await this.s3Service.uploadFile(
        arreteCadrePdf,
        `arrete-cadre/${ac.id}/`,
      );
      toSave.url = s3Response.Location;
    }
    toSave =
      new Date(publishArreteCadreDto.dateDebut) <= new Date()
        ? { ...toSave, ...{ statut: <StatutArreteCadre>'publie' } }
        : { ...toSave, ...{ statut: <StatutArreteCadre>'a_venir' } };
    return this.arreteCadreRepository.save(toSave);
  }

  async repeal(
    id: number,
    repealArreteCadreDto: RepealArreteCadreDto,
    currentUser: User,
  ): Promise<ArreteCadre> {
    if (
      !(await this.canRepealArreteCadre(id, repealArreteCadreDto, currentUser))
    ) {
      throw new HttpException(
        `Abrogation impossible.`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    let toSave = {
      id,
      ...repealArreteCadreDto,
    };
    if (new Date(repealArreteCadreDto.dateFin) <= new Date()) {
      toSave = { ...toSave, ...{ statut: <StatutArreteCadre>'abroge' } };
    }
    return this.arreteCadreRepository.save(toSave);
  }

  async remove(id: number, curentUser: User) {
    if (!(await this.canRemoveArreteCadre(id, curentUser))) {
      throw new HttpException(
        `Vous ne pouvez supprimer un arrêté cadre que si il est sur votre département et qu'il n'est lié à aucun arrêté de restriction.`,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.arreteRestrictionService.deleteByArreteCadreId(id);
    await this.arreteCadreRepository.delete(id);
    return;
  }

  async canUpdateArreteCadre(
    arreteCadre: ArreteCadre,
    user: User,
    containUrl: boolean = false,
  ): Promise<boolean> {
    return (
      arreteCadre &&
      (!containUrl || !!arreteCadre.url) &&
      (user.role === 'mte' ||
        (arreteCadre.statut !== 'abroge' &&
          arreteCadre.departements.some(
            (d) => d.code === user.role_departement,
          )))
    );
  }

  async canRemoveArreteCadre(id: number, user: User): Promise<boolean> {
    const arrete = await this.findOne(id, user);
    /**
     * On peut supprimer un AC s'il est sur le département de l'utilisateur
     * ou si le département de l'utilisateur est le département pilote de l'AC
     * et qu'il n'est lié à aucun AR en cours ou abrogé
     */
    return (
      arrete &&
      !arrete.arretesRestriction.some((ar) =>
        ['a_venir', 'publie', 'abroge'].includes(ar.statut),
      ) &&
      (user.role === 'mte' ||
        arrete.departements.some((d) => d.code === user.role_departement))
    );
  }

  async canRepealArreteCadre(
    id: number,
    repealArreteCadre: RepealArreteCadreDto,
    user: User,
  ): Promise<boolean> {
    const arrete = await this.findOne(id, user);
    if (
      repealArreteCadre.dateFin &&
      new Date(repealArreteCadre.dateFin) < new Date(arrete.dateDebut)
    ) {
      throw new HttpException(
        `La date de fin doit être postérieure à la date de début.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return (
      arrete &&
      ['a_venir', 'publie'].includes(arrete.statut) &&
      (user.role === 'mte' ||
        arrete.departements.some((d) => d.code === user.role_departement))
    );
  }

  private async checkAci(
    createUpdateArreteCadreDto: CreateUpdateArreteCadreDto,
    currentUser: User,
    isUpdate: boolean,
  ): Promise<void> {
    if (createUpdateArreteCadreDto.departements.length > 1) {
      const userDepartement =
        currentUser.role === 'departement'
          ? await this.departementService.findByCode(
              currentUser.role_departement,
            )
          : null;
      /**
       * Si c'est un update, on vérifie seulement que le département est bien dedans
       */
      if (isUpdate && currentUser.role === 'departement') {
        if (
          !createUpdateArreteCadreDto.departements.some(
            (d) => d.id === userDepartement.id,
          )
        ) {
          throw new HttpException(
            `Vous ne pouvez pas modifier un ACI qui ne concerne pas votre département.`,
            HttpStatus.FORBIDDEN,
          );
        } else {
          return;
        }
      }

      /** Si c'est un ACI, on met le département pilote suivant le rôle de l'utilisateur,
       * si l'utilisateur est un rôle MTE, on met le premier département en tant que département pilote **/
      // @ts-expect-error objet non complet
      createUpdateArreteCadreDto.departementPilote =
        currentUser?.role === 'departement'
          ? userDepartement
          : createUpdateArreteCadreDto.departements[0];
    }
  }

  private async sendAciMails(
    oldAc: ArreteCadre,
    newAc: ArreteCadre,
    user: User,
  ) {
    if (newAc.departements.length < 2) {
      return;
    }
    /**
     * On récupère les départements concernés par l'ACI
     * on filtre par ceux qui étaient déjà présents avant (pour éviter les doublons)
     * et on vérifie l'user pour savoir si on doit envoyer un mail au pilote
     */
    const depsToSendMail = newAc.departements.filter((d) => {
      return (
        !oldAc?.departements.some((od) => od.id === d.id) &&
        !(user.role === 'mte' || d.code === user.role_departement)
      );
    });
    if (depsToSendMail.length < 1) {
      return;
    }
    const usersToSendMail = await this.userService.findByDepartementsId(
      depsToSendMail.map((d) => d.id),
    );
    if (usersToSendMail && usersToSendMail.length > 0) {
      usersToSendMail.forEach(async (u) => {
        await this.mailService.sendEmail(
          u.email,
          `Création d'un ACI`,
          'creation_aci',
        );
      });
    }
  }

  /**
   * Mis à jour des statuts des AC tous les jours à 2h du matin
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async updateArreteCadreStatut() {
    const acAVenir = await this.arreteCadreRepository.find({
      where: {
        statut: 'a_venir',
        // @ts-expect-error string date
        dateDebut: LessThanOrEqual(new Date()),
      },
    });
    await this.arreteCadreRepository.update(
      { id: In(acAVenir.map((ac) => ac.id)) },
      { statut: 'publie' },
    );
    this.logger.log(`${acAVenir.length} Arrêtés Cadre publiés`);

    const acPerime = await this.arreteCadreRepository.find({
      where: {
        statut: In(['a_venir', 'publie']),
        // @ts-expect-error string date
        dateFin: LessThan(new Date()),
      },
    });
    await this.arreteCadreRepository.update(
      { id: In(acPerime.map((ac) => ac.id)) },
      { statut: 'abroge' },
    );
    this.logger.log(`${acPerime.length} Arrêtés Cadre abrogés`);

    this.arreteRestrictionService.updateArreteRestrictionStatut();
  }

  /************************************************************************************ TEST FUNCTIONS ************************************************************************************/

  /**
   * Ajouts d'arrêtés cadres pour les tests E2E
   */
  async populateTestData(): Promise<void> {
    for (const ac of testArretesCadre) {
      switch (ac.numero) {
        case 'CYTEST_001':
          ac.departements = [await this.departementService.findByCode('2A')];
          break;
        case 'CYTEST_002':
          ac.departements = [await this.departementService.findByCode('2A')];
          ac.zonesAlerte = await this.zoneAlerteService.findByDepartement('2A');
          // ac.usagesArreteCadre = await this.uageArreteCadreService.findByArreteCadre();
          break;
        case 'CYTEST_003':
          ac.departements = [await this.departementService.findByCode('2A')];
          ac.zonesAlerte = await this.zoneAlerteService.findByDepartement('2A');
          // ac.usagesArreteCadre = await this.uageArreteCadreService.findByArreteCadre();
          break;
        case 'CYTEST_004':
          ac.departements = [
            await this.departementService.findByCode('2A'),
            await this.departementService.findByCode('2B'),
          ];
          ac.zonesAlerte = await this.zoneAlerteService.findByDepartement('2A');
          // ac.usagesArreteCadre = await this.uageArreteCadreService.findByArreteCadre();
          break;
        case 'CYTEST_005':
          ac.departements = [
            await this.departementService.findByCode('2B'),
            await this.departementService.findByCode('2A'),
          ];
          ac.zonesAlerte = await this.zoneAlerteService.findByDepartement('2A');
          // ac.usagesArreteCadre = await this.uageArreteCadreService.findByArreteCadre();
          break;
        case 'CYTEST_006':
          ac.departements = [await this.departementService.findByCode('2A')];
          // ac.usagesArreteCadre = await this.uageArreteCadreService.findByArreteCadre();
          break;
        case 'CYTEST_007':
          ac.departements = [await this.departementService.findByCode('2B')];
          // ac.usagesArreteCadre = await this.uageArreteCadreService.findByArreteCadre();
          break;
      }
      await this.create(JSON.parse(JSON.stringify(ac)), null);
    }
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
