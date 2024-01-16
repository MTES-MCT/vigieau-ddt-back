import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { ZoneAlerte } from './entities/zone_alerte.entity';
import { DepartementService } from '../departement/departement.service';
import {
  ZoneAlerteComparaisonDepartement,
  ZoneAlerteComparaisonZone,
} from './dto/zone_alerte_verification.dto';
import { User } from '../user/entities/user.entity';
import { AcUpdateZoneAlerteDto } from '../arrete_cadre/dto/create_update_arrete_cadre.dto';
import { ArreteCadre } from '../arrete_cadre/entities/arrete_cadre.entity';

@Injectable()
export class ZoneAlerteService {
  constructor(
    @InjectRepository(ZoneAlerte)
    private readonly zoneAlerteRepository: Repository<ZoneAlerte>,
    private readonly departementService: DepartementService,
  ) {}

  findByDepartement(departementCode: string): Promise<ZoneAlerte[]> {
    return this.zoneAlerteRepository.find({
      relations: ['departement'],
      where: {
        departement: {
          code: departementCode,
        },
        disabled: false,
      },
    });
  }

  async importTmpZones(
    file: Express.Multer.File,
    departementCode: string,
    typeZone: 'SUP' | 'SOU',
  ) {
    const geojson = JSON.parse(file.buffer.toString());
    const toInsert: Partial<ZoneAlerte>[] = [];
    const departement =
      await this.departementService.findByCode(departementCode);
    geojson.features.forEach((feature) => {
      toInsert.push({
        nom: feature.properties.nom,
        code: feature.properties.code,
        type: typeZone,
        numeroVersion: -1,
        geom: feature.geometry,
        disabled: true,
        departement: departement,
      });
    });
    const toDeleteWhereClause: FindOptionsWhere<ZoneAlerte> = {
      type: toInsert[0].type,
      numeroVersion: -1,
      departement: {
        id: toInsert[0].departement.id,
      },
    };
    await this.zoneAlerteRepository.delete(toDeleteWhereClause);
    await this.zoneAlerteRepository.save(toInsert);
    await this.zoneAlerteRepository.update(
      {
        numeroVersion: -1,
      },
      {
        geom: () => `ST_TRANSFORM(geom, 2154)`,
      },
    );
  }

  async verifyZones(departementCode: string, typeZone: 'SUP' | 'SOU') {
    const comparaisonZones: ZoneAlerteComparaisonZone[] = await this
      .zoneAlerteRepository.query(`
    SELECT currentZones.code as current_code,
    futureZones.code as futur_code,
    ST_AREA(ST_INTERSECTION(currentZones.geom, futureZones.geom)) / ST_AREA(currentZones.geom) * 100 as percentage_cover,
    ST_AREA(ST_INTERSECTION(currentZones.geom, futureZones.geom)) / 1000000 as area_cover,
    jsonb_build_object(
    'type',       'Feature',
    'geometry',   ST_AsGeoJSON(ST_TRANSFORM(ST_DIFFERENCE(currentZones.geom, futureZones.geom), 4326))::jsonb
) as zone_difference,
    ST_AREA(ST_DIFFERENCE(currentZones.geom, futureZones.geom)) / 1000000 as area_difference
FROM (
        SELECT zone_alerte.code, ST_UNION(zone_alerte.geom) as geom
        FROM zone_alerte
        LEFT JOIN departement on departement.id = zone_alerte."departementId"
        where departement.code = '${departementCode}' and type = '${typeZone}' and disabled = false
        GROUP BY zone_alerte.code
     ) as currentZones, (
        SELECT zone_alerte.code, ST_UNION(zone_alerte.geom) as geom
        FROM zone_alerte
        LEFT JOIN departement on departement.id = zone_alerte."departementId"
        where "numeroVersion" = -1 and departement.code = '${departementCode}' and type = '${typeZone}'
        GROUP BY zone_alerte.code
     ) as futureZones
WHERE ST_INTERSECTS(currentZones.geom, futureZones.geom) and (ST_AREA(ST_INTERSECTION(currentZones.geom, futureZones.geom)) / ST_AREA(currentZones.geom)) > 0.00001
`);
    const comparaisonDepartement: ZoneAlerteComparaisonDepartement[] =
      await this.zoneAlerteRepository.query(`
    select departement.code,
ST_AREA(ST_INTERSECTION(departement.geom, ST_UNION(futureZones.geom))) / ST_AREA(departement.geom) * 100 as percentage_cover,
ST_AREA(ST_DIFFERENCE(ST_UNION(futureZones.geom), departement.geom)) / 1000000 as zone_outside_departement,
jsonb_build_object(
    'type',       'Feature',
    'geometry',   ST_AsGeoJSON(ST_TRANSFORM(ST_DIFFERENCE(departement.geom, ST_UNION(futureZones.geom)), 4326))::jsonb
) as zone_empty_departement_geom,
jsonb_build_object(
    'type',       'Feature',
    'geometry',   ST_AsGeoJSON(ST_TRANSFORM(ST_DIFFERENCE(ST_UNION(futureZones.geom), departement.geom), 4326))::jsonb
) as zone_outside_departement_geom
from zone_alerte as futureZones
left join departement on departement.id = futureZones."departementId"
where "numeroVersion" = -1 and departement.code = '${departementCode}' and type = '${typeZone}'
group by departement.code, departement.geom
    `);
    return {
      comparaisonZones,
      comparaisonDepartement: comparaisonDepartement[0],
    };
  }
}
