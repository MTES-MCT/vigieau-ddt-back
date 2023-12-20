import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ZoneAlerte } from '../../zone_alerte/entities/zone_alerte.entity';
import { StatutArreteCadre } from '../type/statut_arrete_cadre.type';
import { Departement } from '../../departement/entities/departement.entity';
import { UsageArreteCadre } from '../../usage_arrete_cadre/entities/usage_arrete_cadre.entity';

@Entity()
export class ArreteCadre {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, length: 50 })
  numero: string;

  @Column({ type: 'date', nullable: true })
  dateDebut: string;

  @Column({ type: 'date', nullable: true })
  dateFin: string;

  @Column({ nullable: true, length: 200 })
  url: string;

  @Column({ nullable: true, length: 200 })
  urlDdt: string;

  @Column('enum', {
    name: 'statut',
    enum: ['a_valider', 'publie', 'abroge'],
    default: 'a_valider',
    nullable: false,
  })
  statut: StatutArreteCadre;

  @ManyToMany(() => Departement, (departement) => departement.arretesCadre)
  @JoinTable({
    name: 'arrete_cadre_departement',
  })
  departements: Departement[];

  @ManyToMany(() => ZoneAlerte, (zoneAlerte) => zoneAlerte.arretesCadre)
  @JoinTable({
    name: 'arrete_cadre_zone_alerte',
  })
  zonesAlerte: ZoneAlerte[];

  @OneToMany(
    () => UsageArreteCadre,
    (usagesArreteCadre) => usagesArreteCadre.arreteCadre,
    { persistence: false },
  )
  usagesArreteCadre: UsageArreteCadre[];

  @CreateDateColumn({ select: false, type: 'timestamp' })
  created_at: number;

  @UpdateDateColumn({ select: false, type: 'timestamp' })
  updated_at: number;
}
