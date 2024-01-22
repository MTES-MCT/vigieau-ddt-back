import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToMany,
  ManyToOne,
  Polygon,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ArreteCadre } from '../../arrete_cadre/entities/arrete_cadre.entity';
import { BassinVersant } from '../../core/entities/bassin_versant.entity';
import { Departement } from '../../departement/entities/departement.entity';
import { ArreteRestriction } from '../../arrete_restriction/entities/arrete_restriction.entity';

@Entity()
export class ZoneAlerte extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false, length: 200 })
  nom: string;

  @Column({ nullable: false, length: 32 })
  code: string;

  @Column({ nullable: false, length: 50 })
  type: 'SOU' | 'SUP';

  @Column({ nullable: false })
  numeroVersion: number;

  @Column({
    type: 'geometry',
    nullable: false,
    select: false,
  })
  geom: Polygon;

  @Column({ nullable: false, default: false })
  disabled: boolean;

  @ManyToOne(() => Departement, (departement) => departement.zonesAlerte)
  departement: Departement;

  @ManyToOne(() => BassinVersant, (bassinVersant) => bassinVersant.zonesAlerte)
  bassinVersant: BassinVersant;

  @ManyToMany(() => ArreteCadre, (arreteCadre) => arreteCadre.zonesAlerte)
  arretesCadre: ArreteCadre[];

  @ManyToMany(
    () => ArreteRestriction,
    (arreteRestriction) => arreteRestriction.zonesAlerte,
  )
  arretesRestriction: ArreteRestriction[];

  @CreateDateColumn()
  createdAt: Date;
}
