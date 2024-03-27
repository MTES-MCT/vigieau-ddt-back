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

  async computeAll() {
    this.logger.log(`COMPUTING ZONES D'ALERTES - BEGIN`);
    const departements = await this.departementService.findAllLight();
    for (const departement of departements) {
      const zonesSaved = await this.computeRegleAr(departement);
      switch (departement.parametres?.superpositionCommune) {
        case 'no':
        case 'no_all':
          break;
        case 'yes_all':
          if(zonesSaved.length > 0) {
            await this.computeYesDistinct(departement);
          }
          break;
        // case 'yes_only_aep':
        //   await this.computeRegleAr(departement);
        //   break;
        // case 'yes_except_aep':
        //   await this.computeRegleAr(departement);
        //   break;
        case 'yes_distinct':
          if(zonesSaved.length > 0) {
            await this.computeYesDistinct(departement);
          }
          break;
        default:
          this.logger.error(`COMPUTING ${departement.code} - ${departement.nom} - ${departement.parametres?.superpositionCommune} not implemented`, '');
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
          za.restrictions = [{ id: restriction.id }];
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
            restrictions: [{ id: restriction.id }],
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
      return z;
    }).filter(z => z.geom.coordinates.length > 0);
    await this.restrictionService.deleteZonesComputedByDep(departement.id);
    await this.zoneAlerteComputedRepository.delete({ departement: departement });
    const toReturn = await this.zoneAlerteComputedRepository.save(zonesToSave);
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - ${zonesToSave.length} zones ajoutées`);
    return toReturn;
  }

  // Chaque type de zone doit être harmonisé indépendamment à la commune
  async computeYesDistinct(departement) {
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - YES_DISTINCT BEGIN`);
    // On récupères les communes avec des ZA qui ne couvrent pas totalement la zone
    const communes = await this.communeService.getZoneAlerteComputedForHarmonisation(departement.id);
    const zoneTypes = ['SUP', 'SOU', 'AEP'];
    for (const commune of communes) {
      for(const zoneType of zoneTypes) {
        const zonesSameType = commune.zones.filter(z => z.type === zoneType);
        if(zonesSameType.length === 1) {
          console.log(commune.nom);
          console.log(zonesSameType);
        }
      }
    }
    this.logger.log(`COMPUTING ${departement.code} - ${departement.nom} - YES_DISTINCT END`);
  }

  getNiveauGravite(zoneId, restrictions) {
    const r = restrictions.find(r => r.zoneAlerte?.id === zoneId);
    return Utils.getNiveau(r?.niveauGravite);
  }
}
