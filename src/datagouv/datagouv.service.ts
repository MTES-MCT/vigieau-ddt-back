import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RegleauLogger } from '../logger/regleau.logger';
import { ArreteRestrictionService } from '../arrete_restriction/arrete_restriction.service';
import { json2csv } from 'json-2-csv';
import { ConfigService } from '@nestjs/config';
import { writeFile } from 'node:fs/promises';
import { HttpService } from '@nestjs/axios';
import fs from 'fs';
import { catchError, firstValueFrom, lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import moment from 'moment';
import { ZoneAlerteComputedService } from '../zone_alerte_computed/zone_alerte_computed.service';
import { S3Service } from '../shared/services/s3.service';
import JSZip from 'jszip';
import { ArreteCadreService } from '../arrete_cadre/arrete_cadre.service';
import { ArreteRestriction } from '../arrete_restriction/entities/arrete_restriction.entity';
import { DepartementService } from '../departement/departement.service';

@Injectable()
export class DatagouvService {
  private readonly logger = new RegleauLogger('DataGouvService');
  private path;
  private datagouvApiUrl;
  private datagouvApiKey;
  private datagouvResources = {
    'arretes': 'f425cfa6-ccd1-438e-bb03-9d90ab527851',
    'arretes_2012': 'c4e90996-fbdd-4496-9c56-af253900c7bf',
    'arretes_2013': '6ac72ce0-8508-40db-b4bb-91464ae86937',
    'arretes_2014': 'b1a43321-4218-400a-b795-61f956c536a7',
    'arretes_2015': 'a24fc145-bebe-471f-ab01-660c160a19f6',
    'arretes_2016': 'db90caca-ec1c-4b34-8e17-fd7693bd1d35',
    'arretes_2017': 'c1de03e2-f948-4a8b-8d76-cfbaca9d071f',
    'arretes_2018': '2b35ce5f-1539-4909-9473-2b6901447be9',
    'arretes_2019': '1740aa06-2b91-4630-a05b-a46b611dfcbd',
    'arretes_2020': 'a55dda0c-2088-41e2-96a0-2fda3875b7ec',
    'arretes_2021': 'c88b5dcb-7975-4509-865a-5e5d6b3cde97',
    'arretes_2022': '4489197f-63ce-4c8c-aff1-d2e1b02d2943',
    'arretes_2023': '9091f47f-b5b9-4569-b3c9-252f2eae185e',
    'pmtiles': 'a101ef59-0999-4b9a-a682-6f9b79d53c7e',
    'geojson': 'bfba7898-aed3-40ec-aa74-abb73b92a363',
    'restrictions': 'e403a885-5eaf-411d-a03e-751a9c22930d',
    'pmtiles_archive': 'b0b246c3-f724-4eb2-a83a-c516e0044aa2',
    'geojson_archive': '3972a125-2372-41f1-b3f5-25794f860414',
    'arretes_cadre': '0732e970-c12c-4e6a-adca-5ac9dbc3fdfa',
  };

  constructor(private readonly httpService: HttpService,
              @Inject(forwardRef(() => ArreteRestrictionService))
              private readonly arreteRestrictionService: ArreteRestrictionService,
              @Inject(forwardRef(() => ArreteCadreService))
              private readonly arreteCadreService: ArreteCadreService,
              private readonly configService: ConfigService,
              @Inject(forwardRef(() => ZoneAlerteComputedService))
              private readonly zoneAlerteComputedService: ZoneAlerteComputedService,
              private readonly s3Service: S3Service,
              private readonly departementService: DepartementService) {
    this.path = this.configService.get('PATH_TO_WRITE_FILE');
    this.datagouvApiKey = this.configService.get('API_DATAGOUV_KEY');
    this.datagouvApiUrl = `${this.configService.get('API_DATAGOUV')}/datasets/${this.configService.get('API_DATAGOUV_DATASET')}`;
  }

  canUploadToDataGouv(): boolean {
    return this.configService.get('API_DATAGOUV') && this.configService.get('API_DATAGOUV_DATASET') && this.datagouvApiKey;
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async updateDatagouvData() {
    if (!this.canUploadToDataGouv()) {
      return;
    }

    this.logger.log('MISE A JOUR DATAGOUV - DEBUT');
    const arretes = await this.arreteRestrictionService.findDatagouv();
    await this.updateArretes(arretes);
    await this.updateArretesCadre();
    await this.updateHistoriqueArretes(arretes);
    await this.updateRestrictions();
    await this.updateMaps();
    this.logger.log('MISE A JOUR DATAGOUV - FIN');
  }

  async updateArretes(arretes: ArreteRestriction[]) {
    this.logger.log('MISE A JOUR DATAGOUV - ARRETES - DEBUT');

    const departements = await this.departementService.findAllLight();
    const formatArretes = arretes.map(arrete => {
      return {
        id: arrete.id,
        numero: arrete.numero,
        date_debut: arrete.dateDebut,
        date_signature: arrete.dateSignature,
        date_fin: arrete.dateFin,
        statut: arrete.statut,
        departement: arrete.departement.code,
        chemin_fichier: arrete.fichier ? arrete.fichier?.url : '',
        niveau_gravite_specifique_aep: arrete.niveauGraviteSpecifiqueEap,
        ressource_aep_communique: arrete.ressourceEapCommunique,
        arrete_cadre: arrete.arretesCadre.map(arreteCadre => {
          return {
            id: arreteCadre.id,
            numero: arreteCadre.numero,
            date_debut: arreteCadre.dateDebut,
            date_fin: arreteCadre.dateFin,
            chemin_fichier: arreteCadre.fichier ? arreteCadre.fichier?.url : '',
          };
        }),
        zones_alerte: arrete.restrictions.map(restriction => {
          return {
            id: restriction.zoneAlerte?.id,
            type: restriction.communes.length > 0 ? 'AEP' : restriction.zoneAlerte.type,
            code: restriction.zoneAlerte?.code,
            nom: restriction.communes.length > 0 ? restriction.nomGroupementAep : restriction.zoneAlerte.nom,
            niveau_gravite: restriction.niveauGravite,
            id_sandre: restriction.zoneAlerte?.idSandre,
            communes: restriction.communes.map(c => c.code),
          };
        }),
        regle_gestion: departements.find(d => d.code === arrete.departement.code)
          .parametres.find(p =>
            moment(arrete.dateDebut).isSameOrAfter(moment(p.dateDebut))
            && (!p.dateFin || moment(arrete.dateDebut).isSameOrBefore(moment(p.dateFin))),
          )?.superpositionCommune,
      };
    });
    const csv = await json2csv(formatArretes, {
      expandArrayObjects: true,
    });

    await writeFile(`${this.path}/arretes.csv`, csv);
    await this.uploadToDatagouv('arretes', 'arretes.csv', 'Arrêtés');

    this.logger.log('MISE A JOUR DATAGOUV - ARRETES - FIN');
  }

  async updateHistoriqueArretes(arretes: ArreteRestriction[]) {
    this.logger.log('MISE A JOUR DATAGOUV - HISTORIQUE ARRETES - DEBUT');
    const yearBegin = 2012;
    const currentYear = new Date().getFullYear();

    const departements = await this.departementService.findAllLight();

    for (let year = yearBegin; year < currentYear; year++) {
      const formatArretes = arretes
        .filter(arrete => {
          const startDate = moment(`01/01/${year}`, 'DD/MM/YYYY');
          const endDate = moment(`31/12/${year}`, 'DD/MM/YYYY');
          return moment(arrete.dateDebut).isBetween(startDate, endDate, 'days', '[]') ||
            (arrete.dateFin && moment(arrete.dateFin).isBetween(startDate, endDate, 'days', '[]'));
        })
        .map(arrete => {
          return {
            id: arrete.id,
            numero: arrete.numero,
            date_debut: arrete.dateDebut,
            date_signature: arrete.dateSignature,
            date_fin: arrete.dateFin,
            statut: arrete.statut,
            departement: arrete.departement.code,
            chemin_fichier: arrete.fichier ? arrete.fichier?.url : '',
            niveau_gravite_specifique_aep: arrete.niveauGraviteSpecifiqueEap,
            ressource_aep_communique: arrete.ressourceEapCommunique,
            arrete_cadre: arrete.arretesCadre.map(arreteCadre => {
              return {
                id: arreteCadre.id,
                numero: arreteCadre.numero,
                date_debut: arreteCadre.dateDebut,
                date_fin: arreteCadre.dateFin,
                chemin_fichier: arreteCadre.fichier ? arreteCadre.fichier?.url : '',
              };
            }),
            zones_alerte: arrete.restrictions.map(restriction => {
              return {
                id: restriction.zoneAlerte?.id,
                type: restriction.communes.length > 0 ? 'AEP' : restriction.zoneAlerte.type,
                code: restriction.zoneAlerte?.code,
                nom: restriction.communes.length > 0 ? restriction.nomGroupementAep : restriction.zoneAlerte.nom,
                niveau_gravite: restriction.niveauGravite,
                id_sandre: restriction.zoneAlerte?.idSandre,
                communes: restriction.communes.map(c => c.code),
              };
            }),
            regle_gestion: departements.find(d => d.code === arrete.departement.code)
              .parametres.find(p =>
                moment(arrete.dateDebut).isSameOrAfter(moment(p.dateDebut))
                && (!p.dateFin || moment(arrete.dateDebut).isSameOrBefore(moment(p.dateFin))),
              )?.superpositionCommune,
          };
        });
      const csv = await json2csv(formatArretes, {
        expandArrayObjects: true,
      });

      await writeFile(`${this.path}/arretes_${year}.csv`, csv);
      await this.uploadToDatagouv(`arretes_${year}`, `arretes_${year}.csv`, `Arrêtés ${year}`);
    }

    this.logger.log('MISE A JOUR DATAGOUV - HISTORIQUE ARRETES - FIN');
  }

  async updateArretesCadre() {
    this.logger.log('MISE A JOUR DATAGOUV - ARRETES CADRE - DEBUT');

    const arretes = await this.arreteCadreService.findDatagouv();
    const formatArretes = arretes.map(arrete => {
      return {
        id: arrete.id,
        numero: arrete.numero,
        date_debut: arrete.dateDebut,
        date_fin: arrete.dateFin,
        statut: arrete.statut,
        departement_pilote: arrete.departementPilote ? arrete.departementPilote.code : '',
        departements: arrete.departements.map(d => d.code),
        chemin_fichier: arrete.fichier ? arrete.fichier?.url : '',
        zones_alerte: arrete.zonesAlerte.map(zone => {
          return {
            id: zone.id,
            type: zone.type,
            code: zone.code,
            nom: zone.nom,
            id_sandre: zone.idSandre,
          };
        }),
      };
    });
    const csv = await json2csv(formatArretes, {
      expandArrayObjects: true,
    });

    await writeFile(`${this.path}/arretes_cadre.csv`, csv);
    await this.uploadToDatagouv('arretes_cadre', 'arretes_cadre.csv', 'Arrêtés Cadre');

    this.logger.log('MISE A JOUR DATAGOUV - ARRETES CADRE - FIN');
  }

  async updateRestrictions() {
    this.logger.log('MISE A JOUR DATAGOUV - RESTRICTIONS - DEBUT');

    const zonesAlertesComputed = await this.zoneAlerteComputedService.findDatagouv();
    const formatRestrictions = [];
    zonesAlertesComputed.forEach(zoneAlerte => {
      const restriction = {
        zone: {
          nom: zoneAlerte.nom,
          type: zoneAlerte.type,
          departement: zoneAlerte.departement.code,
        },
        niveau_gravite: zoneAlerte.niveauGravite,
        arrete: {
          id: zoneAlerte.restriction.arreteRestriction?.id,
          numero: zoneAlerte.restriction.arreteRestriction?.numero,
        },
      };
      const usages = zoneAlerte.restriction.usages
        .filter(usage => {
          if (zoneAlerte.type === 'SUP') {
            return usage.concerneEsu;
          } else if (zoneAlerte.type === 'SOU') {
            return usage.concerneEso;
          } else if (zoneAlerte.type === 'AEP') {
            return usage.concerneAep;
          }
          return false;
        })
        .map(usage => {
          let description = '';
          switch (zoneAlerte.niveauGravite) {
            case 'vigilance':
              description = usage.descriptionVigilance;
              break;
            case 'alerte':
              description = usage.descriptionAlerte;
              break;
            case 'alerte_renforcee':
              description = usage.descriptionAlerteRenforcee;
              break;
            case 'crise':
              description = usage.descriptionCrise;
              break;
          }
          return {
            nom: usage.nom,
            thematique: usage.thematique.nom,
            concerne_particulier: usage.concerneParticulier,
            concerne_entreprise: usage.concerneEntreprise,
            concerne_collectivite: usage.concerneCollectivite,
            concerne_exploitation: usage.concerneExploitation,
            description: description,
          };
        });
      usages.forEach(u => {
        formatRestrictions.push({
          ...restriction,
          usage: {
            u,
          },
        });
      });
    });
    const csv = json2csv(formatRestrictions, {
      arrayIndexesAsKeys: true,
      expandArrayObjects: true,
    });

    await writeFile(`${this.path}/restrictions.csv`, csv);
    await this.uploadToDatagouv('restrictions', 'restrictions.csv', 'Restrictions');

    this.logger.log('MISE A JOUR DATAGOUV - RESTRICTIONS - FIN');
  }

  async updateMaps(date?: moment.Moment) {
    if (!this.canUploadToDataGouv()) {
      return;
    }

    const dateDebut = date ? date : moment();

    for (let y = dateDebut.year(); y <= moment().year(); y++) {
      await this.generateMapsArchive(dateDebut, y, true);
      await this.generateMapsArchive(dateDebut, y, false);
    }
  }

  async generateMapsArchive(dateDebut: moment.Moment, year: number, geojson?: boolean) {
    const path = this.configService.get('PATH_TO_WRITE_FILE');
    const geojsonOrPmtiles = geojson ? 'geojson' : 'pmtiles';

    console.log(`GENERATION DE L'ARCHIVE ${geojsonOrPmtiles} DE L'ANNEE ${year}`);
    // On récupère le zip existant, si il n'existe pas on le crée
    let dataZip;
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(
          `${this.configService.get('S3_VHOST')}${this.configService.get('S3_PREFIX') ? this.configService.get('S3_PREFIX') : ''}${geojsonOrPmtiles}/zones_${geojsonOrPmtiles}_${year}.zip`,
          { responseType: 'arraybuffer' },
        ),
      );
      dataZip = data;
    } catch (e) {
      this.logger.error(`ARCHIVE ${this.configService.get('S3_VHOST')}${this.configService.get('S3_PREFIX') ? this.configService.get('S3_PREFIX') : ''}${geojsonOrPmtiles}/zones_${geojsonOrPmtiles}_${year}.zip non accessible`, e);
    }
    const zip = dataZip ? await JSZip.loadAsync(dataZip) : new JSZip();

    for (let m = dateDebut;
         m.diff(moment(), 'days', true) <= 0 && m.year() === year;
         m.add(1, 'days')) {
      const fileName = `zones_arretes_en_vigueur_${m.format('YYYY-MM-DD')}.${geojsonOrPmtiles}`;
      try {
        const fileData = fs.readFileSync(`${path}/${fileName}`);
        zip.remove(fileName);
        zip.file(fileName, fileData);
      } catch (e) {
        this.logger.error(`ARCHIVE FICHIER ${fileName} non accessible`, e);
      }
    }

    const newZipData = await zip.generateAsync({ type: 'nodebuffer' });
    const fileToTransfer = {
      originalname: `zones_${geojsonOrPmtiles}_${year}.zip`,
      buffer: newZipData,
    };
    // @ts-ignore
    const s3Response = await this.s3Service.uploadFile(fileToTransfer, `${geojsonOrPmtiles}/`);
    await this.uploadToDatagouv(geojson ? 'geojson_archive' : 'pmtiles_archive', s3Response.Location, `Cartes des zones et arrêtés en vigueur - ${geojson ? 'GEOJSON' : 'PMTILES'} - 2024`, true);
    console.log(`FIN GENERATION DE L'ARCHIVE ${geojsonOrPmtiles} DE L'ANNEE ${year}`);
  }

  async uploadToDatagouv(resource: string, fileName: string, title: string, isUrl = false) {
    this.logger.log(`ENVOI VERS DATAGOUV - ${resource}`);

    if (!this.datagouvResources[resource]) {
      return;
    }

    const url = `${this.datagouvApiUrl}/resources/${this.datagouvResources[resource]}/`;
    if (!isUrl) {
      const data = fs.readFileSync(`${this.path}/${fileName}`);
      const formData = new FormData();
      formData.append('file', new Blob([data]), fileName);

      await lastValueFrom(this.httpService.post(`${url}/upload`, formData, {
        headers: {
          'Accept': 'application/json',
          'X-Api-Key': this.datagouvApiKey,
        },
      }).pipe(
        catchError((error: AxiosError) => {
          this.logger.error('ERREUR DANS L\'ENVOI VERS DATAGOUV', JSON.stringify(error));
          throw 'An error happened!';
        }),
      ));
    }

    const body: any = {
      title: title,
    };
    if (isUrl) {
      body.url = fileName;
    }
    return lastValueFrom(this.httpService.put(url, body, {
      headers: {
        'Accept': 'application/json',
        'X-Api-Key': this.datagouvApiKey,
      },
    }).pipe(
      catchError((error: AxiosError) => {
        this.logger.error('ERREUR DANS LA MISE A JOUR DES METADONNEES DATAGOUV', JSON.stringify(error));
        throw 'An error happened!';
      }),
    ));
  }
}
