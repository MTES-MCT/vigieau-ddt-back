import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Usage } from '../../usage/entities/usage.entity';
import { Restriction } from '../../arrete_restriction/entities/restriction.entity';

@Entity()
@Unique(['usage', 'restriction'])
export class UsageArreteRestriction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Usage, (usage) => usage.usagesArreteRestriction, {
    nullable: false,
    persistence: false,
  })
  @Index()
  usage: Usage;

  @ManyToOne(
    () => Restriction,
    (restriction) => restriction.usagesArreteRestriction,
  )
  @Index()
  restriction: Restriction;

  @Column({ nullable: true })
  concerneParticulier: boolean;

  @Column({ nullable: true })
  concerneEntreprise: boolean;

  @Column({ nullable: true })
  concerneCollectivite: boolean;

  @Column({ nullable: true })
  concerneExploitation: boolean;

  @Column({ default: true })
  concerneEso: boolean;

  @Column({ default: true })
  concerneEsu: boolean;

  @Column({ default: true })
  concerneAep: boolean;

  @Column({ nullable: true, length: 3000 })
  descriptionVigilance: string;

  @Column({ nullable: true, length: 3000 })
  descriptionAlerte: string;

  @Column({ nullable: true, length: 3000 })
  descriptionAlerteRenforcee: string;

  @Column({ nullable: true, length: 3000 })
  descriptionCrise: string;
}
