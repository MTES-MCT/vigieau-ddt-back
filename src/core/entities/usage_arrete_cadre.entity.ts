import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import { ArreteCadre } from '../../arrete_cadre/entities/arrete_cadre.entity';
import { Usage } from '../../usage/entities/usage.entity';

@Entity()
export class UsageArreteCadre {
  @PrimaryColumn({ type: 'int', name: 'usageId' })
  @ManyToOne(() => Usage, (usage) => usage.usagesArreteCadre)
  usage: Usage;

  @PrimaryColumn({ type: 'int', name: 'arreteCadreId' })
  @ManyToOne(() => ArreteCadre, (arreteCadre) => arreteCadre.usagesArreteCadre)
  arreteCadre: ArreteCadre;

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
}
