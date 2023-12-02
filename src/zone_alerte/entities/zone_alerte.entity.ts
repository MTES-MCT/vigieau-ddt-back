import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Departement } from '../../departement/entities/departement.entity';

@Entity()
export class ZoneAlerte {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false, length: 50 })
  code: string;

  @Column({ nullable: false, length: 50 })
  type: 'SOU' | 'SUP';

  @Column({ nullable: false, length: 50 })
  nom: string;

  @Column({ nullable: false })
  surface: number;

  @ManyToOne(() => Departement, (departement) => departement.zones_alerte)
  departement: Departement;
}
