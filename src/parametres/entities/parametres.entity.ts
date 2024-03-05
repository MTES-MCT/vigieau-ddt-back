import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Departement } from '../../departement/entities/departement.entity';
import { SuperpositionCommune } from '../type/parameters.type';

@Entity()
@Unique(['departement'])
export class Parametres extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Departement, (departement) => departement.parametres)
  @JoinColumn()
  departement: Departement;

  @Column('enum', {
    name: 'superpositionCommune',
    enum: [
      'no',
      'no_all',
      'yes_distinct',
      'yes_all',
      'yes_except_aep',
      'yes_only_aep',
    ],
    nullable: false,
  })
  superpositionCommune: SuperpositionCommune;
}
