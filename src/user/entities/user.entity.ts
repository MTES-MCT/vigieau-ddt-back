import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { UserRole } from "../enum/user-role.enum";

@Entity()
export class User {
  @PrimaryColumn({ nullable: false, length: 200 })
  email: string;

  @Column({ nullable: true, length: 50 })
  first_name: string;

  @Column({ nullable: true, length: 50 })
  last_name: string;

  @Column('enum', {
    name: 'role',
    enum: UserRole,
    default: UserRole.departement,
    nullable: false,
  })
  role: UserRole;

  @Column({ nullable: true, length: 10 })
  role_departement: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: number;

  @Column({ default: false })
  disabled: boolean;
}
