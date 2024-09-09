import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RegleauLogger } from '../logger/regleau.logger';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { ArreteMunicipal } from './entities/arrete_municipal.entity';
import { paginate, Paginated, PaginateQuery } from 'nestjs-paginate';
import { arreteMunicipalPaginateConfig } from './dto/arrete_municipal.dto';
import { User } from '../user/entities/user.entity';
import { CreateUpdateArreteMunicipalDto } from './dto/create_update_arrete_municipal.dto';
import moment from 'moment';
import { FichierService } from '../fichier/fichier.service';
import { StatutArreteMunicipal } from './type/arrete_municipal.type';
import { ArreteCadre } from '../arrete_cadre/entities/arrete_cadre.entity';
import { RepealArreteMunicipalDto } from './dto/repeal_arrete_municipal.dto';
import { CommuneService } from '../commune/commune.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from '../shared/services/mail.service';

@Injectable()
export class ArreteMunicipalService {
  private readonly logger = new RegleauLogger('ArreteMunicipalService');

  constructor(
    @InjectRepository(ArreteMunicipal)
    private readonly arreteMunicipalRepository: Repository<ArreteMunicipal>,
    private readonly fichierService: FichierService,
    private readonly communeService: CommuneService,
    private readonly mailService: MailService,
  ) {
  }

  async findAll(query: PaginateQuery, user: User): Promise<Paginated<ArreteMunicipal>> {
    if (user.role === 'departement') {
      query.filter = {
        'communes.departement.code': `$in:${user.role_departements}`,
      };
    } else if (user.role === 'commune') {
      query.filter = {
        'communes.code': `$in:${user.role_communes}`,
      };
    }

    const paginateConfig = arreteMunicipalPaginateConfig;
    const paginateToReturn = await paginate(
      query,
      this.arreteMunicipalRepository,
      paginateConfig,
    );

    return paginateToReturn;
  }

  async findOne(id: number, currentUser?: User) {
    const whereClause: FindOptionsWhere<ArreteMunicipal> | null =
      !currentUser || currentUser.role === 'mte'
        ? { id }
        : currentUser.role === 'departement' ? {
          id,
          communes: {
            departement: {
              code: In(currentUser.role_departements),
            },
          },
        } : {
          id,
          communes: {
            code: In(currentUser.role_communes),
          },
        };
    const arreteMunicipal = await this.arreteMunicipalRepository.findOne({
      select: {
        id: true,
        dateDebut: true,
        dateFin: true,
        statut: true,
        userFirstName: true,
        userLastName: true,
        userEmail: true,
        fichier: {
          id: true,
          nom: true,
          url: true,
          size: true,
        },
        communes: {
          id: true,
          code: true,
          nom: true,
        },
      },
      relations: [
        'fichier',
        'communes',
        'communes.departement',
      ],
      where: whereClause,
      order: {
        communes: {
          code: 'ASC',
        },
      },
    });
    if (!arreteMunicipal) {
      throw new HttpException(
        `L'arrêté municipal n'existe pas ou vous n'avez pas les droits pour le consulter.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return arreteMunicipal;
  }

  async create(
    createArreteMunicipalDto: CreateUpdateArreteMunicipalDto,
    arreteMunicipalPdf: Express.Multer.File,
    user?: User,
  ): Promise<any> {
    if (
      !(await this.canCreateArreteMunicipal(createArreteMunicipalDto, user))
    ) {
      throw new HttpException(
        `Création impossible.`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!arreteMunicipalPdf) {
      throw new HttpException(
        `Le PDF de l'arrêté municipal est obligatoire.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    let am: any = await this.arreteMunicipalRepository.save(<any>createArreteMunicipalDto);
    let newFile = null;
    // Upload du PDF de l'arrêté municipal
    if (arreteMunicipalPdf) {
      newFile = await this.fichierService.create(
        arreteMunicipalPdf,
        `arrete-municipal/${am.id}/`,
      );
      am.fichier = { id: newFile.id };
    }
    am =
      new Date(createArreteMunicipalDto.dateDebut) <= new Date()
        ? createArreteMunicipalDto.dateFin &&
        new Date(createArreteMunicipalDto.dateFin) <= new Date()
          ? { ...am, ...{ statut: <StatutArreteMunicipal>'abroge' } }
          : { ...am, ...{ statut: <StatutArreteMunicipal>'publie' } }
        : { ...am, ...{ statut: <StatutArreteMunicipal>'a_venir' } };
    am = await this.arreteMunicipalRepository.save(am);

    const depCode = am.communes[0] ? am.communes[0].code >= '97' ? am.communes[0].code.slice(0, 3) : am.communes[0].code.slice(0, 2) : null;
    this.mailService.sendEmailsByDepartement(
      depCode,
      `Un nouvel arrêté municipal est publié dans votre département`,
      'creation_am',
      {
        communeNom: am.communes?.map(c => c.nom).join(', '),
        dateDebut: am.dateDebut,
        dateFin: am.dateFin,
        communeContactNom: am.userFirstName + ' ' + am.userLastName,
        communeContactEmail: am.userEmail,
        communeArreteLien: newFile ? newFile.url : '',
        communeLien: `https://${process.env.DOMAIN_NAME}/arrete-municipal`,
      },
      true,
    );

    return am;
  }

  async repeal(
    id: number,
    repealArreteMunicipalDto: RepealArreteMunicipalDto,
    currentUser: User,
  ): Promise<ArreteCadre> {
    const am = await this.findOne(id, currentUser);
    if (
      !(await this.canRepealArreteMunicipal(am, repealArreteMunicipalDto))
    ) {
      throw new HttpException(
        `Abrogation impossible.`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    let toSave = {
      id,
      ...repealArreteMunicipalDto,
    };
    if (moment(repealArreteMunicipalDto.dateFin).isBefore(moment(), 'day')) {
      toSave = { ...toSave, ...{ statut: <StatutArreteMunicipal>'abroge' } };
    }
    return <any>this.arreteMunicipalRepository.save(toSave);
  }

  async remove(id: number, user: User) {
    const arrete = await this.findOne(id, user);
    if (!arrete) {
      throw new HttpException(
        `Vous ne pouvez supprimer un arrêté municipal que si il est sur votre département / commune.`,
        HttpStatus.FORBIDDEN,
      );
    }

    if (arrete.fichier) {
      await this.fichierService.deleteById(arrete.fichier.id);
    }
    await this.arreteMunicipalRepository.delete(id);
    return;
  }

  async canCreateArreteMunicipal(
    createArreteMunicipalDto: CreateUpdateArreteMunicipalDto,
    user: User,
  ): Promise<boolean> {
    if (
      createArreteMunicipalDto.dateFin &&
      moment(createArreteMunicipalDto.dateFin)
        .isBefore(createArreteMunicipalDto.dateDebut, 'day')
    ) {
      throw new HttpException(
        `La date de fin doit être postérieure à la date de début.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return (await this.communeService.getUserCommunes(user, <any>createArreteMunicipalDto.communes)).length === createArreteMunicipalDto.communes.length;
  }

  async canRepealArreteMunicipal(
    arrete: ArreteMunicipal,
    repealArreteMunicipalDto: RepealArreteMunicipalDto,
  ): Promise<boolean> {
    if (
      repealArreteMunicipalDto.dateFin &&
      moment(repealArreteMunicipalDto.dateFin)
        .isBefore(moment(arrete.dateDebut), 'day')
    ) {
      throw new HttpException(
        `La date de fin doit être postérieure à la date de début.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return (
      arrete &&
      ['a_valider', 'a_venir', 'publie'].includes(arrete.statut)
    );
  }

  /**
   * Mis à jour des statuts des AM tous les jours à 2h du matin
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async updateArreteMunicipalStatut() {
    const amAVenir = await this.arreteMunicipalRepository.find({
      where: {
        statut: 'a_venir',
        // @ts-expect-error string date
        dateDebut: LessThanOrEqual(new Date()),
      },
    });
    await this.arreteMunicipalRepository.update(
      { id: In(amAVenir.map((ac) => ac.id)) },
      { statut: 'publie' },
    );
    this.logger.log(`${amAVenir.length} Arrêtés Municipaux publiés`);

    const amPerime = await this.arreteMunicipalRepository.find({
      where: {
        statut: In(['a_venir', 'publie']),
        // @ts-expect-error string date
        dateFin: LessThan(new Date()),
      },
    });
    await this.arreteMunicipalRepository.update(
      { id: In(amPerime.map((ac) => ac.id)) },
      { statut: 'abroge' },
    );
    this.logger.log(`${amPerime.length} Arrêtés Municipaux abrogés`);
  }
}
