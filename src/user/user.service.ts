import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  findAll(curentUser: User): Promise<User[]> {
    const where =
      curentUser.role === 'mte'
        ? {}
        : {
            role: curentUser.role,
            role_departement: curentUser.role_departement,
          };
    return this.userRepository.find({ where });
  }

  findOne(email: string | undefined): Promise<User> {
    if (!email) {
      return null;
    }
    return this.userRepository.findOne({ where: { email } });
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
      return this.userRepository.save(user);
    }
    throw new HttpException(
      'Un utilisateur avec cet email existe déjà.',
      HttpStatus.FORBIDDEN,
    );
  }

  async update(email: string, user: User) {
    await this.userRepository.update({ email }, user);
    return this.findOne(email);
  }

  async remove(curentUser: User, email: string) {
    if (curentUser.role === 'departement') {
      const userToDelete = await this.findOne(email);
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
    return this.userRepository.update({ email }, { disabled: true });
  }
}
