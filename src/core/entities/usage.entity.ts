import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Thematique } from './thematique.entity';

@Entity()
export class Usage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, nullable: false, length: 100 })
  nom: string;

  @ManyToOne(() => Thematique, (thematique) => thematique.usages)
  thematique: Thematique;
}
