import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ZoneAlerteComputed } from './entities/zone_alerte_computed.entity';
import { RegleauLogger } from '../logger/regleau.logger';
import { DepartementService } from '../departement/departement.service';
import { Departement } from '../departement/entities/departement.entity';
import { ZoneAlerteService } from '../zone_alerte/zone_alerte.service';
import { CommuneService } from '../commune/commune.service';
import { ArreteRestrictionService } from '../arrete_restriction/arrete_restriction.service';
import { Utils } from '../core/utils';
import { writeFile } from 'node:fs/promises';
import { S3Service } from '../shared/services/s3.service';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { RestrictionService } from '../restriction/restriction.service';
import { DatagouvService } from '../datagouv/datagouv.service';
import { StatisticService } from '../statistic/statistic.service';

const util = require('util');
const exec = util.promisify(require('child_process').exec);

@Injectable()
export class ZoneAlerteComputedService {
  private readonly logger = new RegleauLogger('ZoneAlerteComputedService');
  private isComputing = false;
  private askForCompute = false;
  private departementsToUpdate = [];

  constructor(
    @InjectRepository(ZoneAlerteComputed)
    private readonly zoneAlerteComputedRepository: Repository<ZoneAlerteComputed>,
    private readonly departementService: DepartementService,
    private readonly zoneAlerteService: ZoneAlerteService,
    private readonly communeService: CommuneService,
    @Inject(forwardRef(() => ArreteRestrictionService))
    private readonly arreteResrictionService: ArreteRestrictionService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    private readonly restrictionService: RestrictionService,
    @Inject(forwardRef(() => DatagouvService))
    private readonly datagouvService: DatagouvService,
    private readonly statisticService: StatisticService,
  ) {
  }

  findOne(id: number): Promise<any> {
    return this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed')
      .select('zone_alerte_computed.id', 'id')
      .addSelect('zone_alerte_computed.code', 'code')
      .addSelect('zone_alerte_computed.nom', 'nom')
      .addSelect('zone_alerte_computed.type', 'type')
      .addSelect(
        'ST_AsGeoJSON(ST_TRANSFORM(zone_alerte_computed.geom, 4326))',
        'geom',
      )
      .where('zone_alerte_computed.id = :id', { id })
      .getRawOne();
  }

  async askCompute(depsIds?: number[], force = false) {
    this.departementsToUpdate = this.departementsToUpdate.concat(depsIds);
    if ((this.isComputing && this.askForCompute && !force)
      || (!this.askForCompute && force)) {
      return;
    }
    if (this.isComputing) {
      this.askForCompute = true;
      // On check toutes les 10s si on peut calculer
      setTimeout(() => {
        this.askCompute([], true);
      }, 10 * 1000);
      return;
    }
    try {
      this.askForCompute = false;
      this.isComputing = true;
      await this.computeAll([...new Set(this.departementsToUpdate)]);
    } catch (e) {
    }
    this.isComputing = false;
  }

  async findOneWithCommuneZone(id: number, communeId: number): Promise<any> {
    const zoneFull = await this.zoneAlerteComputedRepository.findOne({
      where: { id },
      relations: ['departement', 'bassinVersant', 'restriction'],
    });
    const zoneGeom = await this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed')
      .select(
        `ST_AsGeoJSON(ST_TRANSFORM((select commune.geom from commune where commune.id = ${communeId}), 4326))`,
        'geom',
      )
      .where('zone_alerte_computed.id = :id', { id })
      .getRawOne();
    zoneFull.geom = zoneGeom.geom;
    return zoneFull;
  }

  async computeAll(depsId?: number[]) {
    this.logger.log(`COMPUTING ZONES D'ALERTES - BEGIN`);
    this.departementsToUpdate = [];
    let departements = await this.departementService.findAllLight();
    if (depsId && depsId.length > 0) {
      departements = departements.filter(d => depsId.some(dep => dep === d.id));
    }
    for (const departement of departements) {
      const zonesSaved = await this.computeRegleAr(departement);
      if (zonesSaved.length > 0) {
        switch (departement.parametres?.superpositionCommune) {
          case 'no':
          case 'no_all':
            break;
          case 'yes_all':
            await this.computeYesDistinct(departement, false);
            await this.computeYesAll(departement, false);
            break;
          case 'yes_only_aep':
            await this.computeYesDistinct(departement, true);
            break;
          case 'yes_except_aep':
            await this.computeYesDistinct(departement, false);
            await this.computeYesAll(departement, true);
            break;
          case 'yes_distinct':
            await this.computeYesDistinct(departement, false);
            break;
          default:
            this.logger.error(`COMPUTING ${departement.code} - ${departement.nom} - ${departement.parametres?.superpositionCommune} not implemented`, '');
        }
      }
      await this.computeCommunesIntersected(departement);
    }
    // On récupère toutes les restrictions en cours
    this.logger.log(`COMPUTING ZONES D'ALERTES - END`);
    await this.computeGeoJson();
  }

  async computeRegleAr(departement: Departement) {
    const arretesRestrictions = await this.arreteResrictionService.findByDepartement(departement.code);
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${arretesRestrictions.length} arrêtés de restriction`);
    let zonesToSave = [];
    for (const ar of arretesRestrictions) {
      for (const restriction of ar.restrictions) {
        if (restriction.zoneAlerte) {
          const za = await this.zoneAlerteService.findOne(restriction.zoneAlerte.id);
          za.restriction = { id: restriction.id, niveauGravite: restriction.niveauGravite };
          za.departement = { id: departement.id };
          // SAUVEGARDE ZONE ESU ou ESO
          zonesToSave.push(za);
        } else if (restriction.communes?.length > 0) {
          const za = {
            nom: restriction.nomGroupementAep,
            type: 'AEP',
            geom: null,
            departement: { id: departement.id },
            bassinVersant: null,
            restriction: { id: restriction.id, niveauGravite: restriction.niveauGravite },
          };
          za.geom = (await this.communeService.getUnionGeomOfCommunes(restriction.communes)).geom;
          // SAUVEGARDE ZONE AEP
          zonesToSave.push(za);
        }
      }
    }

    zonesToSave = zonesToSave.map(z => {
      z.id = null;
      z.geom = JSON.parse(z.geom);
      z.niveauGravite = z.restriction.niveauGravite;
      return z;
    }).filter(z => z.geom.coordinates.length > 0);
    await this.zoneAlerteComputedRepository.delete({ departement: IsNull() });
    await this.zoneAlerteComputedRepository.delete({ departement: departement });
    const toReturn = await this.zoneAlerteComputedRepository.save(zonesToSave);
    if (toReturn.length > 0) {
      await this.cleanZones(departement);
    }
    if (!departement.parametres?.superpositionCommune || departement.parametres?.superpositionCommune !== 'yes_all') {
      await this.computeRegleAepNotSpecific(departement);
    }
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${zonesToSave.length} zones ajoutées`);
    return toReturn;
  }

  async computeRegleAepNotSpecific(departement: Departement) {
    const arretesRestrictions = await this.arreteResrictionService.findByDepartement(departement.code);
    const zonesDepartement = await this.getZonesAlerteComputedByDepartement(departement);
    let zonesToSave = [];
    for (const ar of arretesRestrictions) {
      let zonesAr = zonesDepartement.filter(z => z.restriction.arreteRestriction.id === ar.id);
      if (ar.niveauGraviteSpecifiqueEap === false && ar.ressourceEapCommunique && zonesAr.length > 0) {
        switch (ar.ressourceEapCommunique) {
          case 'eso':
          case 'esu':
            let zonesAep = zonesAr.filter((z) => z.type === (ar.ressourceEapCommunique === 'eso' ? 'SOU' : 'SUP') && ar.restrictions.some(r => r.id === z.restriction.id));
            zonesAep = JSON.parse(JSON.stringify(zonesAep));
            zonesAep = zonesAep.map(z => {
              z.type = 'AEP';
              return z;
            });
            zonesToSave = zonesToSave.concat(zonesAep);
            break;
          case 'max':
            const zonesEsu: any = JSON.parse(JSON.stringify(zonesAr.filter(z => z?.type === 'SUP')));
            const zonesEso: any = JSON.parse(JSON.stringify(zonesAr.filter(z => z?.type === 'SOU')));
            // On boucle sur les zones ESU et on stock un tableau intersect avec les zones ESO
            if (zonesEsu.length > 0 && zonesEso.length > 0) {
              for (const zoneEsu of zonesEsu) {
                zoneEsu.intersect = (await this.getIntersect(zoneEsu.id, zonesEso.map(z => z.id)));
              }
            }
            // Pour les zones de l'AR qui ne s'intersectent pas, on peut les copier et les enregistrer sous AEP
            const zonesWithoutIntersection = zonesEsu
              .filter(z => !z.intersect || z.intersect.length < 1)
              .concat(zonesEso.filter(z => !zonesEsu.some(ze => ze.intersect.some(i => i.id === z.id))))
              .map(z => {
                z.type = 'AEP';
                return z;
              });
            zonesToSave = zonesToSave.concat(zonesWithoutIntersection);
            // Pour chaque couple de zone qui s'intersectent, vérifier celle qui a le niveau de gravité max et qui doit être prioritaire
            let zonesWithIntersection = zonesEsu
              .filter(z => z.intersect && z.intersect.length > 0)
              .concat(zonesEso.filter(z => zonesEsu.some(ze => ze.intersect?.some(i => i.id === z.id))))
              .map(z => {
                z.add = [];
                z.remove = [];
                return z;
              });
            for (const z of zonesEsu.filter(z => z.intersect && z.intersect.length > 0)) {
              for (const zIntersected of z.intersect) {
                // On décide ici quelle portion de quelle zone on ajoute ou on enlève à l'autre
                // Si même niveau de gravité, on prend la zone SUP au pif
                if (this.getNiveauGravite(z.id, ar.restrictions) >= this.getNiveauGravite(zIntersected.id, ar.restrictions)) {
                  zonesWithIntersection.find(zwi => zwi.id === z.id).add.push(zIntersected.id);
                  zonesWithIntersection.find(zwi => zwi.id === zIntersected.id).remove.push(z.id);
                } else {
                  zonesWithIntersection.find(zwi => zwi.id === z.id).remove.push(zIntersected.id);
                  zonesWithIntersection.find(zwi => zwi.id === zIntersected.id).add.push(z.id);
                }
              }
            }
            for (const z of zonesWithIntersection) {
              // On construit les nouvelles géométries de zones
              z.geom = (await this.computeNewZone(z)).geom;
            }
            zonesWithIntersection = zonesWithIntersection.map(z => {
              z.type = 'AEP';
              return z;
            });
            zonesToSave = zonesToSave.concat(zonesWithIntersection);
            break;
        }
      }
    }
    zonesToSave = zonesToSave.map(z => {
      z.id = null;
      z.geom = JSON.parse(z.geom);
      return z;
    }).filter(z => z.geom.coordinates.length > 0);
    const toReturn = await this.zoneAlerteComputedRepository.save(zonesToSave);
    if (toReturn.length > 0) {
      await this.cleanZones(departement);
    }
  }

  // Chaque type de zone doit être harmonisé indépendamment à la commune
  async computeYesDistinct(departement, onlyAep: boolean) {
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${onlyAep ? 'YES_ONLY_AEP' : 'YES_DISTINCT'} BEGIN`);
    // On récupères les communes avec des ZA qui ne couvrent pas totalement la zone
    const communes = await this.communeService.getZoneAlerteComputedForHarmonisation(departement.id);
    const zoneTypes = onlyAep ? ['AEP'] : ['SUP', 'SOU', 'AEP'];
    const queries = [];
    for (const commune of communes) {
      for (const zoneType of zoneTypes) {
        const zonesSameType = commune.zones.filter(z => z.type === zoneType);
        // Quand une seule zone, on l'agrandie à la geometrie de la commune
        if (zonesSameType.length === 1 && zonesSameType[0].areaCommunePercentage >= 5) {
          queries.push(this.getQueryToExtendZone(zonesSameType[0].id, commune.id));
        } else if (zonesSameType.length > 1) {
          // Si plusieurs zones, soit elles sont toutes au même niveau de gravité et on prend celle qui couvre le plus le territoire
          // Soit on prend celle qui a le niveau de gravité le plus élevé
          const zonesSameTypeExploitables = zonesSameType
            .filter(z => z.areaCommunePercentage >= 5);
          if (zonesSameTypeExploitables.length >= 1) {
            const maxNiveauGravite = zonesSameTypeExploitables
              .reduce((prev, current) => {
                return Utils.getNiveau(prev.niveauGravite) > Utils.getNiveau(current.niveauGravite) ? prev : current;
              });
            const zonesSameTypeMaxNiveau = zonesSameTypeExploitables.filter(z => z.niveauGravite === maxNiveauGravite.niveauGravite);
            const zoneToExtend = zonesSameTypeMaxNiveau.length === 1 ?
              zonesSameTypeMaxNiveau[0] :
              zonesSameTypeMaxNiveau.reduce((prev, current) => {
                return prev.areaCommune > current.areaCommune ? prev : current;
              });
            const zonesToReduce = zonesSameType.filter(z => z.id !== zoneToExtend.id);
            queries.push(this.getQueryToExtendZone(zoneToExtend.id, commune.id));
            zonesToReduce.forEach(z => {
              queries.push(this.getQueryToReduceZone(z.id, commune.id));
            });
          }
        }
      }
    }
    await Promise.all(queries.map(q => q.execute()));
    await this.cleanZones(departement);
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${onlyAep ? 'YES_ONLY_AEP' : 'YES_DISTINCT'} END`);
  }

  async computeYesAll(departement, exceptAep: boolean) {
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${exceptAep ? 'YES_EXCEPT_AEP' : 'YES_ALL'} BEGIN`);
    // On récupères les communes avec des ZA (même celles qui couvrent totalement la commune)
    const communes = await this.communeService.getZoneAlerteComputedForHarmonisation(departement.id);
    const zoneTypes = exceptAep ? ['SUP', 'SOU'] : ['SUP', 'SOU', 'AEP'];
    const queries = [];
    let zonesToSave = [];
    for (const commune of communes) {
      // On filtre sur les aires des zones / communes pour éviter les zones résiduelles
      const zones = commune.zones.filter(z => zoneTypes.includes(z.type) && commune.area.toFixed(10) === z.areaCommune.toFixed(10));
      if (!zones || zones.length <= 0) {
        continue;
      }
      const maxNiveauGravite = zones.reduce((prev, current) => {
        return Utils.getNiveau(prev.niveauGravite) > Utils.getNiveau(current.niveauGravite) ? prev : current;
      }).niveauGravite;
      for (const zoneType of zoneTypes) {
        // Normalement il y a au maximum une zone par type mais si ils ont fait plusieurs AR avec des règles de gestions différentes il se peut que plusieurs zones AEP se superposent
        const zonesSameType = zones.filter(z => z.type === zoneType);

        if (zonesSameType.length === 1 && zonesSameType[0].niveauGravite !== maxNiveauGravite) {

          // Si il n'y a qu'une zone et que ce n'est pas son niveau de gravité de base, on la duplique pour avoir la zone au niveau de la commune avec le bon niveau de gravité
          let zoneToDuplicate = await this.findOneWithCommuneZone(zonesSameType[0].id, commune.id);
          zoneToDuplicate.niveauGravite = maxNiveauGravite;
          zonesToSave.push(zoneToDuplicate);
          queries.push(this.getQueryToReduceZone(zonesSameType[0].id, commune.id));

        } else if (zonesSameType.length > 1) {

          // Si plusieurs zones du même type, on prend celle qui a le niveau de gravité le plus élevé, ou une au pif
          const maxNiveauGraviteZonesSameType = zonesSameType.reduce((prev, current) => {
            return Utils.getNiveau(prev.niveauGravite) > Utils.getNiveau(current.niveauGravite) ? prev : current;
          }).niveauGravite;
          let zoneToKeep = zonesSameType.filter(z => z.niveauGravite === maxNiveauGraviteZonesSameType);
          if (zoneToKeep.length > 1) {
            zoneToKeep = zoneToKeep.reduce((prev, current) => {
              return prev.areaCommune > current.areaCommune ? prev : current;
            });
          } else {
            zoneToKeep = zoneToKeep[0];
          }
          if (zoneToKeep.niveauGravite !== maxNiveauGravite) {
            let zoneToDuplicate = await this.findOneWithCommuneZone(zoneToKeep.id, commune.id);
            zoneToDuplicate.niveauGravite = maxNiveauGravite;
            zonesToSave.push(zoneToDuplicate);
            queries.push(this.getQueryToReduceZone(zoneToKeep.id, commune.id));
          } else {
            queries.push(this.getQueryToExtendZone(zoneToKeep.id, commune.id));
          }
          zonesSameType.filter(z => z.id !== zoneToKeep.id).forEach(z => {
            queries.push(this.getQueryToReduceZone(z.id, commune.id));
          });

        } else if (zonesSameType.length <= 0) {
          // Si il n'y a pas de zone, on en crée une
          let zoneToDuplicate = zones.filter(z => z.niveauGravite === maxNiveauGravite).reduce((prev, current) => {
            return prev.areaCommune > current.areaCommune ? prev : current;
          });
          zoneToDuplicate = await this.findOneWithCommuneZone(zoneToDuplicate.id, commune.id);
          zoneToDuplicate.type = zoneType;
          zonesToSave.push(zoneToDuplicate);

        }
      }
    }
    await Promise.all(queries.map(q => q.execute()));
    zonesToSave = zonesToSave.map(z => {
      z.id = null;
      z.geom = JSON.parse(z.geom);
      return z;
    });
    await this.zoneAlerteComputedRepository.save(zonesToSave);
    await this.cleanZones(departement);
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${exceptAep ? 'YES_EXCEPT_AEP' : 'YES_ALL'} END`);
  }

  getNiveauGravite(zoneId, restrictions) {
    const r = restrictions.find(r => r.zonesAlerteComputed?.some(z => z.id === zoneId));
    return Utils.getNiveau(r?.niveauGravite);
  }

  getQueryToExtendZone(zoneId, communeId) {
    return this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed')
      .update()
      .set({ geom: () => `ST_UNION(zone_alerte_computed.geom, (select c.geom from commune as c where c.id = ${communeId}))` })
      .where('zone_alerte_computed.id = :id', { id: zoneId });
  }

  getQueryToReduceZone(zoneId, communeId) {
    return this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed')
      .update()
      .set({ geom: () => `ST_DIFFERENCE(zone_alerte_computed.geom, (select c.geom from commune as c where c.id = ${communeId}))` })
      .where('zone_alerte_computed.id = :id', { id: zoneId });
  }

  async cleanZones(departement: Departement) {
    await this.zoneAlerteComputedRepository.createQueryBuilder('zone_alerte_computed')
      .update()
      .set({ geom: () => `st_makevalid(geom, 'method=structure keepcollapsed=false')` })
      .where('not st_isvalid(geom)')
      .andWhere('"departementId" = :id', { id: departement.id })
      .execute();
    return this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed')
      .update()
      .set({ geom: () => 'ST_CollectionExtract(geom, 3)' })
      .where('"departementId" = :id', { id: departement.id })
      .execute();
  }

  async computeGeoJson() {
    let allZonesComputed: any = await this.zoneAlerteComputedRepository.find({
      select: {
        id: true,
        code: true,
        nom: true,
        type: true,
        departement: {
          code: true,
          nom: true,
        },
        restriction: {
          niveauGravite: true,
          arreteRestriction: {
            id: true,
            numero: true,
            dateDebut: true,
            dateFin: true,
            dateSignature: true,
            fichier: {
              url: true,
            },
          },
          usages: {
            nom: true,
            concerneParticulier: true,
            concerneEntreprise: true,
            concerneExploitation: true,
            concerneCollectivite: true,
            concerneEso: true,
            concerneEsu: true,
            concerneAep: true,
            descriptionVigilance: true,
            descriptionAlerte: true,
            descriptionAlerteRenforcee: true,
            descriptionCrise: true,
            thematique: {
              nom: true,
            },
          },
        },
      },
      relations: [
        'departement',
        'restriction',
        'restriction.usages',
        'restriction.usages.thematique',
        'restriction.arreteRestriction',
        'restriction.arreteRestriction.fichier',
      ],
    });

    const allZones = await Promise.all(allZonesComputed.map(async z => {
      z.geom = JSON.parse((await this.findOne(z.id)).geom);
      return {
        type: 'Feature',
        geometry: z.geom,
        properties: {
          id: z.id,
          nom: z.nom,
          code: z.code,
          type: z.type,
          niveauGravite: z.restriction?.niveauGravite,
          departement: z.departement,
          arreteRestriction: {
            id: z.restriction?.arreteRestriction.id,
            numero: z.restriction?.arreteRestriction.numero,
            dateDebut: z.restriction?.arreteRestriction.dateDebut,
            dateFin: z.restriction?.arreteRestriction.dateFin,
            dateSignature: z.restriction?.arreteRestriction.dateSignature,
            fichier: z.restriction?.arreteRestriction.fichier?.url,
          },
          restrictions: z.restriction?.usages.map(u => {
            let d;
            switch (z.restriction.niveauGravite) {
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
                d = u.descriptionCrise;
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
              description: d,
            };
          }),
        },
      };
    }));

    const geojson = {
      'type': 'FeatureCollection',
      'features': allZones,
    };

    const path = this.configService.get('PATH_TO_WRITE_FILE');

    const date = new Date();
    await writeFile(`${path}/zones_arretes_en_vigueur.geojson`, JSON.stringify(geojson));
    const dataGeojson = fs.readFileSync(`${path}/zones_arretes_en_vigueur.geojson`);
    const fileToTransferGeojson = {
      originalname: `zones_arretes_en_vigueur.geojson`,
      buffer: dataGeojson,
    };
    try {
      const fileNameToSaveGeoJson = `zones_arretes_en_vigueur_${date.toISOString().split('T')[0]}.geojson`;
      await this.s3Service.copyFile(fileToTransferGeojson.originalname, fileNameToSaveGeoJson, 'geojson/');
      // @ts-ignore
      const s3ResponseGeojson = await this.s3Service.uploadFile(fileToTransferGeojson, 'geojson/');
      await this.datagouvService.uploadToDatagouv('geojson', s3ResponseGeojson.Location, 'Carte des zones et arrêtés en vigueur - GeoJSON', true);
    } catch (e) {
      this.logger.error('ERROR COPYING GEOJSON', e);
    }
    try {
      await exec(`${path}/tippecanoe_program/bin/tippecanoe -zg -pg -ai -pn -f --drop-densest-as-needed -l zones_arretes_en_vigueur --read-parallel --detect-shared-borders --simplification=10 --output=${path}/zones_arretes_en_vigueur.pmtiles ${path}/zones_arretes_en_vigueur.geojson`);
      const data = fs.readFileSync(`${path}/zones_arretes_en_vigueur.pmtiles`);
      const fileToTransfer = {
        originalname: 'zones_arretes_en_vigueur.pmtiles',
        buffer: data,
      };
      try {
        const fileNameToSave = `zones_arretes_en_vigueur_${date.toISOString().split('T')[0]}.pmtiles`;
        await this.s3Service.copyFile(fileToTransfer.originalname, fileNameToSave, 'pmtiles/');
      } catch (e) {
        this.logger.error('ERROR COPYING PMTILES', e);
      }
      // @ts-ignore
      const s3Response = await this.s3Service.uploadFile(fileToTransfer, 'pmtiles/');
      await this.zoneAlerteComputedRepository.update({}, { enabled: true });

      await this.datagouvService.uploadToDatagouv('pmtiles', s3Response.Location, 'Carte des zones et arrêtés en vigueur - PMTILES', true);
    } catch (e) {
      this.logger.error('ERROR GENERATING PMTILES', e);
    }
    this.statisticService.computeDepartementsSituation(allZonesComputed);
  }

  async computeCommunesIntersected(departement: Departement) {
    const zones = await this.zoneAlerteComputedRepository.createQueryBuilder('zone_alerte_computed')
      .select(['zone_alerte_computed.id', 'zone_alerte_computed.nom', 'zone_alerte_computed.code', 'zone_alerte_computed.type'])
      .leftJoin('zone_alerte_computed.departement', 'departement')
      .leftJoinAndSelect('commune', 'commune', 'commune.departement = departement.id AND ST_INTERSECTS(zone_alerte_computed.geom, commune.geom) AND ST_Area(ST_Intersection(zone_alerte_computed.geom, commune.geom)) > 0.000000001')
      .where('departement.id = :id', { id: departement.id })
      .getRawMany();
    const toSave = [];
    zones.forEach(z => {
      if (!toSave.some(s => s.id === z.zone_alerte_computed_id)) {
        toSave.push({
          id: z.zone_alerte_computed_id,
          communes: [],
        });
      }
      const s = toSave.find(s => s.id === z.zone_alerte_computed_id);
      if (z.commune_id) {
        s.communes.push({
          id: z.commune_id,
        });
      }
    });
    await this.zoneAlerteComputedRepository.save(toSave);
  }

  async getZonesAlerteComputedByDepartement(departement: Departement): Promise<ZoneAlerteComputed[]> {
    const zonesDepartement = await this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed')
      .select('ST_AsGeoJSON(ST_TRANSFORM(zone_alerte_computed.geom, 4326))', 'geom')
      .addSelect('zone_alerte_computed.id', 'id')
      .addSelect('zone_alerte_computed.nom', 'nom')
      .addSelect('zone_alerte_computed.code', 'code')
      .addSelect('zone_alerte_computed.type', 'type')
      .addSelect('departement.id', 'departement_id')
      .addSelect('"niveauGravite"')
      .leftJoin('zone_alerte_computed.departement', 'departement')
      .where('departement.id = :id', { id: departement.id })
      .getRawMany();
    // @ts-ignore
    await Promise.all(zonesDepartement.map(async z => {
      z.restriction = await this.restrictionService.findOneByZoneAlerteComputed(z.id);
      z.departement = {
        id: z.departement_id,
      };
      return z;
    }));
    return zonesDepartement;
  }

  computeNewZone(zone: any) {
    const qb = this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed');
    let sqlString = `ST_AsGeoJSON(ST_TRANSFORM(`;
    if (zone.remove && zone.remove.length > 0) {
      sqlString += `ST_DIFFERENCE(zone_alerte_computed.geom, `;
      sqlString += `(SELECT ST_UNION(zaBis.geom) FROM zone_alerte_computed as zaBis WHERE zaBis.id IN (${zone.remove.join(', ')}))`;
      sqlString += `)`;
    } else {
      sqlString += `zone_alerte_computed.geom`;
    }
    sqlString += `, 4326))`;
    return qb.select(sqlString, 'geom')
      .where('zone_alerte_computed.id = :id', { id: zone.id })
      .getRawOne();
  }

  getIntersect(zoneId: number, otherZonesId: number[]) {
    return this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed')
      .select('zone_alerte_computed.id', 'id')
      .addSelect('zone_alerte_computed.code', 'code')
      .addSelect('zone_alerte_computed.nom', 'nom')
      .addSelect('zone_alerte_computed.type', 'type')
      .where('zone_alerte_computed.id != :id', { id: zoneId })
      .andWhere('zone_alerte_computed.id IN(:...ids)', { ids: otherZonesId })
      .andWhere('ST_INTERSECTS(zone_alerte_computed.geom, (SELECT zaBis.geom FROM zone_alerte_computed as zaBis WHERE zaBis.id = :id))', { id: zoneId })
      .getRawMany();
  }

  async findDatagouv(): Promise<ZoneAlerteComputed[]> {
    return this.zoneAlerteComputedRepository.find({
      select: {
        id: true,
        code: true,
        nom: true,
        type: true,
        niveauGravite: true,
        restriction: {
          id: true,
          arreteRestriction: {
            id: true,
            numero: true,
          },
          usages: {
            id: true,
            nom: true,
            thematique: {
              nom: true,
            },
            concerneParticulier: true,
            concerneEntreprise: true,
            concerneCollectivite: true,
            concerneExploitation: true,
            concerneEsu: true,
            concerneEso: true,
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
      },
      relations: [
        'restriction',
        'restriction.arreteRestriction',
        'restriction.usages',
        'restriction.usages.thematique',
        'departement',
      ],
    });
  }
}
