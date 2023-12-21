import {
  BaseEntity,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ZoneAlerte } from '../../zone_alerte/entities/zone_alerte.entity';

@Entity()
export class BassinVersant extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  code: number;

  @Column({ nullable: false, length: 60 })
  nom: string;

  @OneToMany(() => ZoneAlerte, (zoneAlerte) => zoneAlerte.bassinVersant)
  zonesAlerte: ZoneAlerte[];
}
