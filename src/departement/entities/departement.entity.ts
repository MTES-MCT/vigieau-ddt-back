import {
  BaseEntity,
  Column,
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  OneToMany,
  Polygon,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ZoneAlerte } from '../../zone_alerte/entities/zone_alerte.entity';
import { ArreteCadre } from '../../arrete_cadre/entities/arrete_cadre.entity';
import { Region } from '../../core/entities/region.entity';

@Entity()
export class Departement extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: false, length: 3 })
  code: string;

  @Column({ nullable: false, length: 60 })
  nom: string;

  @Column({
    type: 'geometry',
    nullable: true,
    select: false,
  })
  geom: Polygon;

  @ManyToOne(() => Region, (region) => region.departements)
  region: Region;

  @OneToMany(() => ZoneAlerte, (zoneAlerte) => zoneAlerte.departement)
  zonesAlerte: ZoneAlerte[];

  @ManyToMany(() => ArreteCadre, (arreteCadre) => arreteCadre.departements)
  arretesCadre: ArreteCadre[];

  @OneToMany(() => ArreteCadre, (arreteCadre) => arreteCadre.departements)
  arretesCadrePilote: ArreteCadre[];
}
