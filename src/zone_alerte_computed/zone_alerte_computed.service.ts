import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZoneAlerteComputed } from './entities/zone_alerte_computed.entity';
import { RestrictionService } from '../restriction/restriction.service';
import { RegleauLogger } from '../logger/regleau.logger';
import { DepartementService } from '../departement/departement.service';
import { Departement } from '../departement/entities/departement.entity';
import { ZoneAlerteService } from '../zone_alerte/zone_alerte.service';
import { CommuneService } from '../commune/commune.service';
import { ArreteRestrictionService } from '../arrete_restriction/arrete_restriction.service';
import { Utils } from '../core/utils';

@Injectable()
export class ZoneAlerteComputedService {
  private readonly logger = new RegleauLogger('ZoneAlerteComputedService');

  constructor(
    @InjectRepository(ZoneAlerteComputed)
    private readonly zoneAlerteComputedRepository: Repository<ZoneAlerteComputed>,
    private readonly restrictionService: RestrictionService,
    private readonly departementService: DepartementService,
    private readonly zoneAlerteService: ZoneAlerteService,
    private readonly communeService: CommuneService,
    @Inject(forwardRef(() => ArreteRestrictionService))
    private readonly arreteResrictionService: ArreteRestrictionService,
  ) {
    setTimeout(() => {
      this.computeAll();
    }, 1000);
  }

  async findOneWithCommuneZone(id: number, communeId: number): Promise<any> {
    const zoneFull = await this.zoneAlerteComputedRepository.findOne({
      where: { id },
      relations: ['departement', 'bassinVersant', 'restrictions'],
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

  async computeAll() {
    this.logger.log(`COMPUTING ZONES D'ALERTES - BEGIN`);
    const departements = await this.departementService.findAllLight();
    for (const departement of departements) {
      const zonesSaved = await this.computeRegleAr(departement);
      if(zonesSaved.length > 0) {
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
    }
    // On récupère toutes les restrictions en cours
    this.logger.log(`COMPUTING ZONES D'ALERTES - END`);
  }

  async computeRegleAr(departement: Departement) {
    const arretesRestrictions = await this.arreteResrictionService.findByDepartement(departement.code);
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${arretesRestrictions.length} arrêtés de restriction`);
    let zonesToSave = [];
    for (const ar of arretesRestrictions) {
      let zonesArToSave = [];
      for (const restriction of ar.restrictions) {
        if (restriction.zoneAlerte) {
          const za = await this.zoneAlerteService.findOne(restriction.zoneAlerte.id);
          za.restrictions = [{ id: restriction.id, niveauGravite: restriction.niveauGravite }];
          za.departement = { id: departement.id };
          // SAUVEGARDE ZONE ESU ou ESO
          zonesArToSave.push(za);
        } else if (restriction.communes?.length > 0) {
          const za = {
            nom: restriction.nomGroupementAep,
            type: 'AEP',
            geom: null,
            departement: { id: departement.id },
            bassinVersant: null,
            restrictions: [{ id: restriction.id, niveauGravite: restriction.niveauGravite }],
          };
          za.geom = (await this.communeService.getUnionGeomOfCommunes(restriction.communes)).geom;
          // SAUVEGARDE ZONE AEP
          zonesArToSave.push(za);
        }
      }

      // Si pas de zone spécifique AEP, on en crée suivant la règle définie dans l'arrêté de restriction
      if (ar.niveauGraviteSpecifiqueEap === false) {
        switch (ar.ressourceEapCommunique) {
          case 'eso':
          case 'esu':
            let zonesAep = zonesArToSave.filter((z) => z.type === (ar.ressourceEapCommunique === 'eso' ? 'SOU' : 'SUP') && ar.restrictions.some(r => r.id === z.restrictions[0].id));
            zonesAep = JSON.parse(JSON.stringify(zonesAep));
            zonesAep = zonesAep.map(z => {
              z.type = 'AEP';
              return z;
            });
            zonesArToSave = zonesArToSave.concat(zonesAep);
            break;
          case 'max':
            const zonesEsu: any = JSON.parse(JSON.stringify(zonesArToSave.filter(z => z?.type === 'SUP')));
            const zonesEso: any = JSON.parse(JSON.stringify(zonesArToSave.filter(z => z?.type === 'SOU')));
            // On boucle sur les zones ESU et on stock un tableau intersect avec les zones ESO
            for (const zoneEsu of zonesEsu) {
              zoneEsu.intersect = (await this.zoneAlerteService.getIntersect(zoneEsu.id, zonesEso.map(z => z.id)));
            }
            // Pour les zones de l'AR qui ne s'intersectent pas, on peut les copier et les enregistrer sous AEP
            const zonesWithoutIntersection = zonesEsu
              .filter(z => !z.intersect || z.intersect.length < 1)
              .concat(zonesEso.filter(z => !zonesEsu.some(ze => ze.intersect.some(i => i.id === z.id))))
              .map(z => {
                z.type = 'AEP';
                return z;
              });
            zonesArToSave = zonesArToSave.concat(zonesWithoutIntersection);
            // Pour chaque couple de zone qui s'intersectent, vérifier celle qui a le niveau de gravité max et qui doit être prioritaire
            let zonesWithIntersection = zonesEsu
              .filter(z => z.intersect && z.intersect.length > 0)
              .concat(zonesEso.filter(z => zonesEsu.some(ze => ze.intersect.some(i => i.id === z.id))))
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
              for (const z of zonesWithIntersection) {
                // On construit les nouvelles géométries de zones
                z.geom = (await this.zoneAlerteService.computeNewZone(z)).geom;
              }
              zonesWithIntersection = zonesWithIntersection.map(z => {
                z.type = 'AEP';
                return z;
              });
            }
            zonesArToSave = zonesArToSave.concat(zonesWithIntersection);
            break;
        }
      }
      zonesToSave = zonesToSave.concat(JSON.parse(JSON.stringify(zonesArToSave)));
    }

    zonesToSave = zonesToSave.map(z => {
      z.id = null;
      z.geom = JSON.parse(z.geom);
      z.niveauGravite = z.restrictions[0].niveauGravite;
      return z;
    }).filter(z => z.geom.coordinates.length > 0);
    await this.restrictionService.deleteZonesComputedByDep(departement.id);
    await this.zoneAlerteComputedRepository.delete({ departement: departement });
    const toReturn = await this.zoneAlerteComputedRepository.save(zonesToSave);
    if(toReturn.length > 0) {
      await this.cleanZones();
    }
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${zonesToSave.length} zones ajoutées`);
    return toReturn;
  }

  // Chaque type de zone doit être harmonisé indépendamment à la commune
  async computeYesDistinct(departement, onlyAep: boolean) {
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${onlyAep ? 'YES_ONLY_AEP' : 'YES_DISTINCT'} BEGIN`);
    // On récupères les communes avec des ZA qui ne couvrent pas totalement la zone
    const communes = await this.communeService.getZoneAlerteComputedForHarmonisation(departement.id, true);
    const zoneTypes = onlyAep ? ['AEP'] : ['SUP', 'SOU', 'AEP'];
    const queries = [];
    for (const commune of communes) {
      for(const zoneType of zoneTypes) {
        const zonesSameType = commune.zones.filter(z => z.type === zoneType);
        // Quand une seule zone, on l'agrandie à la geometrie de la commune
        if(zonesSameType.length === 1) {
          queries.push(this.getQueryToExtendZone(zonesSameType[0].id, commune.id));
        } else if(zonesSameType.length > 1) {
          // Si plusieurs zones, soit elles sont toutes au même niveau de gravité et on prend celle qui couvre le plus le territoire
          // Soit on prend celle qui a le niveau de gravité le plus élevé
          const maxNiveauGravite = zonesSameType.reduce((prev, current) => {
            return Utils.getNiveau(prev.niveauGravite) > Utils.getNiveau(current.niveauGravite) ? prev : current;
          });
          const zonesSameTypeMaxNiveau = zonesSameType.filter(z => z.niveauGravite === maxNiveauGravite.niveauGravite);
          const zoneToExtend = zonesSameTypeMaxNiveau.length === 1 ?
            zonesSameTypeMaxNiveau[0] :
            zonesSameTypeMaxNiveau.reduce((prev, current) => {
            return prev.area > current.area ? prev : current;
          });
          const zonesToReduce = zonesSameType.filter(z => z.id !== zoneToExtend.id);
          queries.push(this.getQueryToExtendZone(zoneToExtend.id, commune.id));
          zonesToReduce.forEach(z => {
            queries.push(this.getQueryToReduceZone(z.id, commune.id));
          });
        }
      }
    }
    await Promise.all(queries.map(q => q.execute()));
    await this.cleanZones();
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${onlyAep ? 'YES_ONLY_AEP' : 'YES_DISTINCT'} END`);
  }

  async computeYesAll(departement, exceptAep: boolean) {
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${exceptAep ? 'YES_EXCEPT_AEP' : 'YES_ALL'} BEGIN`);
    // On récupères les communes avec des ZA (même celles qui couvrent totalement la commune)
    const communes = await this.communeService.getZoneAlerteComputedForHarmonisation(departement.id, false);
    const zoneTypes = exceptAep ? ['SUP', 'SOU'] : ['SUP', 'SOU', 'AEP'];
    const queries = [];
    let zonesToSave = [];
    for (const commune of communes) {
      // On filtre sur les aires des zones / communes pour éviter les zones résiduelles
      const zones = commune.zones.filter(z => zoneTypes.includes(z.type) && commune.area.toFixed(10) === z.areaCommune.toFixed(10));
      if(!zones || zones.length <= 0) {
        continue;
      }
      const maxNiveauGravite = zones.reduce((prev, current) => {
        return Utils.getNiveau(prev.niveauGravite) > Utils.getNiveau(current.niveauGravite) ? prev : current;
      }).niveauGravite;
      for (const zoneType of zoneTypes) {
        // Normalement il y a au maximum une zone par type mais si ils ont fait plusieurs AR avec des règles de gestions différentes il se peut que plusieurs zones AEP se superposent
        const zonesSameType = zones.filter(z => z.type === zoneType);

        if(zonesSameType.length === 1 && zonesSameType[0].niveauGravite !== maxNiveauGravite) {

          // Si il n'y a qu'une zone et que ce n'est pas son niveau de gravité de base, on la duplique pour avoir la zone au niveau de la commune avec le bon niveau de gravité
          let zoneToDuplicate = await this.findOneWithCommuneZone(zonesSameType[0].id, commune.id);
          zoneToDuplicate.niveauGravite = maxNiveauGravite;
          zonesToSave.push(zoneToDuplicate);
          queries.push(this.getQueryToReduceZone(zonesSameType[0].id, commune.id));

        } else if(zonesSameType.length > 1) {

          // Si plusieurs zones du même type, on prend celle qui a le niveau de gravité le plus élevé, ou une au pif
          const maxNiveauGraviteZonesSameType = zonesSameType.reduce((prev, current) => {
            return Utils.getNiveau(prev.niveauGravite) > Utils.getNiveau(current.niveauGravite) ? prev : current;
          }).niveauGravite;
          let zoneToKeep = zonesSameType.filter(z => z.niveauGravite === maxNiveauGraviteZonesSameType);
          if(zoneToKeep.length > 1) {
            zoneToKeep = zoneToKeep.reduce((prev, current) => {
              return prev.areaCommune > current.areaCommune ? prev : current;
            });
          } else {
            zoneToKeep = zoneToKeep[0];
          }
          if(zoneToKeep.niveauGravite !== maxNiveauGravite) {
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

        } else if(zonesSameType.length <= 0) {
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
    await this.cleanZones();
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${exceptAep ? 'YES_EXCEPT_AEP' : 'YES_ALL'} END`);
  }

  getNiveauGravite(zoneId, restrictions) {
    const r = restrictions.find(r => r.zoneAlerte?.id === zoneId);
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

  getQueryToUpdateNiveauGravite(zoneId, niveauGravite) {
    return this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed')
      .update()
      .set({ niveauGravite: niveauGravite })
      .where('zone_alerte_computed.id = :id', { id: zoneId });
  }

  cleanZones() {
    return this.zoneAlerteComputedRepository
      .createQueryBuilder('zone_alerte_computed')
      .update()
      .set({ geom: () => 'ST_CollectionExtract(geom, 3)'})
      .execute()
  }
}
