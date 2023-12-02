import { Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ArreteCadre {
  @PrimaryGeneratedColumn()
  id: number;
}
