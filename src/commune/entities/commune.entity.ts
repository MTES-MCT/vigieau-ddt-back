import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  Polygon,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Departement } from '../../departement/entities/departement.entity';

@Entity()
export class Commune extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: false, length: 6 })
  code: string;

  @Column({ nullable: false })
  nom: string;

  @Column({ nullable: true })
  population: number;

  @Column({
    type: 'geometry',
    nullable: true,
    select: false,
  })
  geom: Polygon;

  @ManyToOne(() => Departement, (departement) => departement.communes)
  departement: Departement;

  @Column({ nullable: false, default: false })
  disabled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
