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

const exec = util.promisify(require('child_process').exec);

@Injectable()
export class ZoneAlerteComputedHistoricService {
  private readonly logger = new RegleauLogger('ZoneAlerteComputedHistoricService');

  constructor(@Inject(forwardRef(() => ArreteRestrictionService))
              private readonly arreteResrictionService: ArreteRestrictionService,
              private readonly zoneAlerteService: ZoneAlerteService,
              private readonly configService: ConfigService,
              private readonly s3Service: S3Service) {
    if (this.configService.get('NODE_ENV') !== 'local') {
      this.computeHistoricMaps();
    }
  }

  async computeHistoricMaps() {
    const dateDebut = moment('01/01/2012', 'DD/MM/YYYY');
    const dateFin = moment('31/12/2012', 'DD/MM/YYYY');

    for (let m = moment(dateDebut); m.diff(dateFin, 'days') <= 0; m.add(1, 'days')) {
      const ars = await this.arreteResrictionService.findByDate(m);
      let zas: any[] = await this.zoneAlerteService.findByArreteRestriction(ars.map(ar => ar.id));
      zas = zas.map(z => {
        z.geom = JSON.parse(z.geom);
        return {
          type: 'Feature',
          geometry: z.geom,
          properties: {
            id: z.id,
            nom: z.nom,
            code: z.code,
            type: z.type,
            niveauGravite: z.niveauGravite,
            arreteRestriction: {
              id: z.ar_id,
              numero: z.ar_numero,
            },
          },
        };
      });

      const geojson = {
        'type': 'FeatureCollection',
        'features': zas,
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