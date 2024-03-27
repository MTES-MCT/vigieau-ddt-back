import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity, Index,
  ManyToOne,
  OneToMany,
  Polygon,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { BassinVersant } from '../../core/entities/bassin_versant.entity';
import { Departement } from '../../departement/entities/departement.entity';
import { Restriction } from '../../restriction/entities/restriction.entity';
import { NiveauGravite } from '../../arrete_restriction/type/niveau_gravite.type';

@Entity()
export class ZoneAlerteComputed extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false, length: 200 })
  nom: string;

  @Column({ nullable: true, length: 32 })
  code: string;

  @Column({ nullable: false, length: 50 })
  type: 'SOU' | 'SUP' | 'AEP';

  @Column({
    type: 'geometry',
    nullable: false,
    select: false,
  })
  geom: Polygon;

  @Column('enum', {
    name: 'niveauGravite',
    enum: ['vigilance', 'alerte', 'alerte_renforcee', 'crise'],
    nullable: true,
  })
  niveauGravite: NiveauGravite;

  @ManyToOne(() => Departement, (departement) => departement.zoneAlerteComputed)
  @Index()
  departement: Departement;

  @ManyToOne(() => BassinVersant, (bassinVersant) => bassinVersant.zoneAlerteComputed)
  bassinVersant: BassinVersant;

  @OneToMany(() => Restriction, (restriction) => restriction.zoneAlerteComputed)
  restrictions: Restriction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
