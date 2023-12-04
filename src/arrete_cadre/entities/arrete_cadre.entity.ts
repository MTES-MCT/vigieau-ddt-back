import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ZoneAlerte } from '../../zone_alerte/entities/zone_alerte.entity';
import { ArreteCadreStatus } from '../type/arrete_cadre-status.type';

@Entity()
export class ArreteCadre {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false, length: 50 })
  numero: string;

  @Column('enum', {
    name: 'statut',
    enum: ['brouillon', 'termine'],
    default: 'brouillon',
    nullable: false,
  })
  statut: ArreteCadreStatus;

  @ManyToMany(() => ZoneAlerte, (zoneAlerte) => zoneAlerte.arretes_cadre)
  zones_alerte: ZoneAlerte[];
}
