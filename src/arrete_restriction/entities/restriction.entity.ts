import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ZoneAlerte } from '../../zone_alerte/entities/zone_alerte.entity';
import { NiveauGravite } from '../type/niveau_gravite.type';
import { UsageArreteRestriction } from '../../usage_arrete_restriction/entities/usage_arrete_restriction.entity';
import { ArreteRestriction } from './arrete_restriction.entity';

@Entity()
@Unique(['arreteRestriction', 'zoneAlerte'])
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

  @OneToMany(
    () => UsageArreteRestriction,
    (usagesArreteRestriction) => usagesArreteRestriction.restriction,
  )
  usagesArreteRestriction: UsageArreteRestriction[];
}
