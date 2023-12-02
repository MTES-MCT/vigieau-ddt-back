import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { ZoneAlerte } from '../../zone_alerte/entities/zone_alerte.entity';

@Entity()
export class Departement {
  @PrimaryColumn()
  code: number;

  @Column({ nullable: false, length: 50 })
  code_iso: string;

  @Column({ nullable: false, length: 50 })
  nom: string;

  @Column({ nullable: false })
  surface: number;

  @OneToMany(() => ZoneAlerte, (zoneAlerte) => zoneAlerte.departement)
  zones_alerte: ZoneAlerte[];
}
