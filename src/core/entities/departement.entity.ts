import {
  Column,
  Entity,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ZoneAlerte } from '../../zone_alerte/entities/zone_alerte.entity';
import { ArreteCadre } from '../../arrete_cadre/entities/arrete_cadre.entity';
import { Region } from './region.entity';

@Entity()
export class Departement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: false, length: 3 })
  code: string;

  @Column({ nullable: false, length: 60 })
  nom: string;

  @ManyToOne(() => Region, (region) => region.departements)
  region: Region;

  @OneToMany(() => ZoneAlerte, (zoneAlerte) => zoneAlerte.departement)
  zonesAlerte: ZoneAlerte[];

  @ManyToMany(() => ArreteCadre, (arreteCadre) => arreteCadre.departements)
  arretesCadre: ArreteCadre[];
}
