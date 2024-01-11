import {
  BaseEntity,
  Column,
  Entity,
  Index,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StatutArreteRestriction } from '../type/statut_arrete_restriction.type';
import { ArreteCadre } from '../../arrete_cadre/entities/arrete_cadre.entity';

@Entity()
export class ArreteRestriction extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, length: 50 })
  numero: string;

  @Column({ type: 'date', nullable: true })
  dateSignature: string;

  @Column({ type: 'date', nullable: true })
  dateDebut: string;

  @Column({ type: 'date', nullable: true })
  dateFin: string;

  @Column('enum', {
    name: 'statut',
    enum: ['a_valider', 'a_venir', 'publie', 'abroge'],
    default: 'a_valider',
    nullable: false,
  })
  statut: StatutArreteRestriction;

  @ManyToMany(
    () => ArreteCadre,
    (arreteCadre) => arreteCadre.arretesRestriction,
    { onDelete: 'CASCADE' },
  )
  arretesCadre: ArreteCadre[];
}
