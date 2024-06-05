import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RegleauLogger } from '../logger/regleau.logger';
import moment from 'moment';
import { ArreteRestrictionService } from '../arrete_restriction/arrete_restriction.service';
import { ZoneAlerteService } from '../zone_alerte/zone_alerte.service';
import { writeFile } from 'node:fs/promises';
import fs from 'fs';
import { ConfigService } from '@nestjs/config';
import util from 'util';
import { S3Service } from '../shared/services/s3.service';
import { ZoneAlerte } from '../zone_alerte/entities/zone_alerte.entity';

const exec = util.promisify(require('child_process').exec);

@Injectable()
export class ZoneAlerteComputedHistoricService {
  private readonly logger = new RegleauLogger('ZoneAlerteComputedHistoricService');

  constructor(@Inject(forwardRef(() => ArreteRestrictionService))
              private readonly arreteResrictionService: ArreteRestrictionService,
              private readonly zoneAlerteService: ZoneAlerteService,
              private readonly configService: ConfigService,
              private readonly s3Service: S3Service) {
    // setTimeout(() => {
    //   this.computeHistoricMaps();
    // }, 5000);
  }

  async computeHistoricMaps() {
    const dateDebut = moment('01/01/2018', 'DD/MM/YYYY');
    // const dateFin = moment('31/12/2019', 'DD/MM/YYYY');
    const dateFin = moment('28/04/2024', 'DD/MM/YYYY');

    for (let m = moment(dateDebut); m.diff(dateFin, 'days') <= 0; m.add(1, 'days')) {
      const ars = await this.arreteResrictionService.findByDate(m);
      let zas: ZoneAlerte[] = await this.zoneAlerteService.findByArreteRestriction(ars.map(ar => ar.id));
      const zasFormated = await Promise.all(zas.map(async z => {
        z.geom = JSON.parse((await this.zoneAlerteService.findOne(z.id)).geom);
        return {
          type: 'Feature',
          geometry: z.geom,
          properties: {
            id: z.id,
            idSandre: z.idSandre,
            nom: z.nom,
            code: z.code,
            type: z.type,
            niveauGravite: z.restrictions[0].niveauGravite,
            departement: z.departement,
            arreteRestriction: {
              id: z.restrictions[0].arreteRestriction.id,
              numero: z.restrictions[0].arreteRestriction.numero,
              dateDebut: z.restrictions[0].arreteRestriction.dateDebut,
              dateFin: z.restrictions[0].arreteRestriction.dateFin,
              dateSignature: z.restrictions[0].arreteRestriction.dateSignature,
              fichier: z.restrictions[0].arreteRestriction.fichier?.url,
            },
            restrictions: z.restrictions[0].usages.map(u => {
              let d;
              switch (z.restrictions[0].niveauGravite) {
                case 'vigilance':
                  d = u.descriptionVigilance;
                  break;
                case 'alerte':
                  d = u.descriptionAlerte;
                  break;
                case 'alerte_renforcee':
                  d = u.descriptionAlerteRenforcee;
                  break;
                case 'crise':
                  d = u.descriptionCrise
                  break;
              }
              return {
                nom: u.nom,
                thematique: u.thematique.nom,
                concerneParticulier: u.concerneParticulier,
                concerneEntreprise: u.concerneEntreprise,
                concerneCollectivite: u.concerneCollectivite,
                concerneExploitation: u.concerneExploitation,
                concerneEso: u.concerneEso,
                concerneEsu: u.concerneEsu,
                concerneAep: u.concerneAep,
                description: d
              }
            })
          },
        };
      }));

      const geojson = {
        'type': 'FeatureCollection',
        'features': zasFormated,
      };

      const path = this.configService.get('PATH_TO_WRITE_FILE');

      const fileNameToSave = `zones_arretes_en_vigueur_${m.format('YYYY-MM-DD')}`;
      await writeFile(`${path}/${fileNameToSave}.geojson`, JSON.stringify(geojson));
      try {
        await exec(`${path}/tippecanoe_program/bin/tippecanoe -zg -pg -ai -pn -f --drop-densest-as-needed -l zones_arretes_en_vigueur --read-parallel --detect-shared-borders --simplification=10 --output=${path}/${fileNameToSave}.pmtiles ${path}/${fileNameToSave}.geojson`);
        const dataPmtiles = fs.readFileSync(`${path}/${fileNameToSave}.pmtiles`);
        const fileToTransferPmtiles = {
          originalname: `${fileNameToSave}.pmtiles`,
          buffer: dataPmtiles,
        };
        const dataGeojson = fs.readFileSync(`${path}/${fileNameToSave}.geojson`);
        const fileToTransferGeojson = {
          originalname: `${fileNameToSave}.geojson`,
          buffer: dataGeojson,
        };
        // @ts-ignore
        await this.s3Service.uploadFile(fileToTransferPmtiles, 'pmtiles/');
        // @ts-ignore
        await this.s3Service.uploadFile(fileToTransferGeojson, 'geojson/');
      } catch (e) {
        this.logger.error('ERROR GENERATING PMTILES', e);
      }
    }
  }
}