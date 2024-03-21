import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { DeleteResult, Like, Repository } from 'typeorm';
import { Departement } from '../departement/entities/departement.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  findAll(curentUser?: User): Promise<User[]> {
    const where =
      !curentUser || curentUser.role === 'mte'
        ? {}
        : {
            role: curentUser.role,
            role_departement: curentUser.role_departement,
          };
    return this.userRepository.find({ where, order: { email: 'ASC' }});
  }

  findOne(email: string | undefined): Promise<User> {
    if (!email) {
      return null;
    }
    return this.userRepository.findOne({ where: { email } });
  }

  updateName(email: string, firstName: string, lastName: string) {
    return this.userRepository.update(
      { email },
      { first_name: firstName, last_name: lastName },
    );
  }

  findByDepartementsId(depIds: number[]): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect(
        Departement,
        'departement',
        'departement.code = user.role_departement',
      )
      .where('departement.id IN (:...depIds)', { depIds })
      .getMany();
  }

  async create(curentUser: User, user: User): Promise<User> {
    if (
      curentUser.role === 'departement' &&
      (user.role !== 'departement' ||
        curentUser.role_departement !== user.role_departement)
    ) {
      throw new HttpException(
        "Vous ne pouvez créer un utilisateur qu'avec un droit sur votre département.",
        HttpStatus.FORBIDDEN,
      );
    }
    const userExists = await this.findOne(user.email);
    if (!userExists) {
      return this.userRepository.save(this._formatUser(user));
    }
    throw new HttpException(
      'Un utilisateur avec cet email existe déjà.',
      HttpStatus.FORBIDDEN,
    );
  }

  async update(email: string, user: User) {
    await this.userRepository.update({ email }, this._formatUser(user));
    return this.findOne(email);
  }

  async remove(curentUser: User, email: string) {
    if (curentUser.role === 'departement') {
      const userToDelete = await this.findOne(email);
      if (!userToDelete) {
        throw new HttpException(
          "Cet utilisateur n'existe pas",
          HttpStatus.BAD_REQUEST,
        );
      }
      if (
        userToDelete.role !== curentUser.role ||
        userToDelete.role_departement !== curentUser.role_departement
      ) {
        throw new HttpException(
          'Vous ne pouvez supprimer des utilisateurs que sur votre département.',
          HttpStatus.FORBIDDEN,
        );
      }
    }
    return this.userRepository.delete({ email });
  }

  private _formatUser(user: User) {
    if (user.role === 'mte') {
      user.role_departement = null;
    }
    return user;
  }

  /**
   * Suppression des données générées par les tests E2E
   * Par convention les données générées par les tests E2E sont préfixées par CYTEST
   */
  removeTestData(): Promise<DeleteResult> {
    return this.userRepository.delete({ email: Like('CYTEST%') });
  }
}
