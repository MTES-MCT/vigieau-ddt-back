import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';
import { UserRole } from '../type/user-role.type';

@Entity()
export class User extends BaseEntity {
  @PrimaryColumn({ nullable: false, length: 200 })
  email: string;

  @Column({ nullable: true, length: 50 })
  first_name: string;

  @Column({ nullable: true, length: 50 })
  last_name: string;

  @Column('enum', {
    name: 'role',
    enum: ['mte', 'departement'],
    default: 'departement',
    nullable: false,
  })
  role: UserRole;

  @Column({ nullable: true, length: 10 })
  role_departement: string;

  @Column('text',{ nullable: true, array: true })
  role_departements: string[];

  @CreateDateColumn({ select: false, type: 'timestamp' })
  created_at: number;
}
