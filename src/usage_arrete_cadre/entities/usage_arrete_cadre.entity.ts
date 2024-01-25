import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ArreteCadre } from '../../arrete_cadre/entities/arrete_cadre.entity';
import { Usage } from '../../usage/entities/usage.entity';
import { Restriction } from '../../arrete_restriction/entities/restriction.entity';

@Entity()
@Unique(['usage', 'arreteCadre'])
export class UsageArreteCadre {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Usage, (usage) => usage.usagesArreteCadre, {
    nullable: false,
    persistence: false,
  })
  @Index()
  usage: Usage;

  @ManyToOne(
    () => ArreteCadre,
    (arreteCadre) => arreteCadre.usagesArreteCadre,
    { nullable: false, persistence: false, onDelete: 'CASCADE' },
  )
  @Index()
  arreteCadre: ArreteCadre;

  @ManyToOne(
    () => Restriction,
    (restriction) => restriction.usagesArreteCadre,
    { nullable: true },
  )
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
