import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  Polygon,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { BassinVersant } from '../../core/entities/bassin_versant.entity';
import { Departement } from '../../departement/entities/departement.entity';
import { Restriction } from '../../restriction/entities/restriction.entity';

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

  @ManyToOne(() => Departement, (departement) => departement.zoneAlerteComputed)
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
