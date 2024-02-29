import {
  BaseEntity,
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ZoneAlerte } from '../../zone_alerte/entities/zone_alerte.entity';
import { NiveauGravite } from '../../arrete_restriction/type/niveau_gravite.type';
import { UsageArreteRestriction } from '../../usage_arrete_restriction/entities/usage_arrete_restriction.entity';
import { ArreteRestriction } from '../../arrete_restriction/entities/arrete_restriction.entity';
import { Commune } from '../../commune/entities/commune.entity';

@Entity()
@Unique(['arreteRestriction', 'zoneAlerte'])
export class Restriction extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, length: 255 })
  nomGroupementAep: string;

  @ManyToOne(
    () => ArreteRestriction,
    (arreteRestriction) => arreteRestriction.restrictions,
    { nullable: false, persistence: false, onDelete: 'CASCADE' },
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
    { persistence: false },
  )
  usagesArreteRestriction: UsageArreteRestriction[];

  @ManyToMany(() => Commune, (commune) => commune.restrictions)
  @JoinTable({
    name: 'restriction_commune',
  })
  communes: Commune[];
}
