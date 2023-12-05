import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ArreteCadre } from './arrete_cadre.entity';

@Entity()
export class StatutArreteCadre {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: false, length: 50 })
  nom: string;

  @OneToMany(() => ArreteCadre, (arretesCadre) => arretesCadre.statut)
  arretesCadre: ArreteCadre[];
}
