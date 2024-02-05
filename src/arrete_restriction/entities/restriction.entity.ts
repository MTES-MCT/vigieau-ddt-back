import {
  BaseEntity,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ZoneAlerte } from '../../zone_alerte/entities/zone_alerte.entity';
import { NiveauGravite } from '../type/niveau_gravite.type';
import { UsageArreteCadre } from '../../usage_arrete_cadre/entities/usage_arrete_cadre.entity';
import { ArreteRestriction } from './arrete_restriction.entity';

@Entity()
export class Restriction extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => ArreteRestriction,
    (arreteRestriction) => arreteRestriction.restrictions,
  )
  arreteRestriction: ArreteRestriction;

  @ManyToOne(() => ZoneAlerte, (zoneAlerte) => zoneAlerte.restrictions)
  zoneAlerte: ZoneAlerte;

  @Column('enum', {
    name: 'niveauGravite',
    enum: ['vigilance', 'alerte', 'alerte_renforcee', 'crise'],
    nullable: true,
  })
  niveauGravite: NiveauGravite;

  @ManyToMany(
    () => UsageArreteCadre,
    (usagesArreteCadre) => usagesArreteCadre.restrictions,
  )
  @JoinTable({
    name: 'restriction_usage_arrete_cadre',
  })
  usagesArreteCadre: UsageArreteCadre[];
}
