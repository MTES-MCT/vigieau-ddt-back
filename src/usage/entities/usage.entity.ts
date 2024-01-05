import {
  BaseEntity,
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Thematique } from '../../thematique/entities/thematique.entity';
import { UsageArreteCadre } from '../../usage_arrete_cadre/entities/usage_arrete_cadre.entity';

@Entity()
export class Usage extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: false, length: 255 })
  nom: string;

  @ManyToOne(() => Thematique, (thematique) => thematique.usages)
  @Index()
  thematique: Thematique;

  @Column({ default: false })
  isTemplate: boolean;

  @Column({ nullable: true })
  concerneParticulier: boolean;

  @Column({ nullable: true })
  concerneEntreprise: boolean;

  @Column({ nullable: true })
  concerneCollectivite: boolean;

  @Column({ nullable: true })
  concerneExploitation: boolean;

  @Column({ nullable: true, length: 3000 })
  descriptionVigilance: string;

  @Column({ nullable: true, length: 3000 })
  descriptionAlerte: string;

  @Column({ nullable: true, length: 3000 })
  descriptionAlerteRenforcee: string;

  @Column({ nullable: true, length: 3000 })
  descriptionCrise: string;

  @OneToMany(
    () => UsageArreteCadre,
    (usagesArreteCadre) => usagesArreteCadre.usage,
  )
  usagesArreteCadre: UsageArreteCadre[];
}
