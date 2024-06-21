import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Parametres } from './entities/parametres.entity';
import { ArreteRestriction } from '../arrete_restriction/entities/arrete_restriction.entity';
import { DepartementService } from '../departement/departement.service';

@Injectable()
export class ParametresService {
  constructor(
    @InjectRepository(Parametres)
    private readonly parametresRepository: Repository<Parametres>,
    private readonly departementService: DepartementService,
  ) {
  }

  async findAll(currentUser?: User): Promise<Parametres[]> {
    const whereClause: FindOptionsWhere<ArreteRestriction> | null =
      !currentUser || currentUser.role === 'mte'
        ? {}
        : {
          departement: {
            code: In(currentUser.role_departements),
          },
        };
    return this.parametresRepository.find({
      select: {
        id: true,
        superpositionCommune: true,
        departement: {
          id: true,
          code: true,
        },
      },
      relations: ['departement'],
      where: whereClause,
    });
  }

  async findOne(depCode: string): Promise<Parametres> {
    return this.parametresRepository.findOne({
      select: {
        id: true,
        superpositionCommune: true,
        departement: {
          id: true,
          code: true,
        },
      },
      relations: ['departement'],
      where: {
        departement: {
          code: depCode,
        },
      },
    });
  }

  async createUpdate(
    currentUser: User,
    depCode: string,
    parametres: Parametres,
  ): Promise<Parametres> {
    if (
      currentUser &&
      currentUser.role !== 'mte' &&
      !currentUser.role_departements.includes(depCode)
    ) {
      throw new HttpException(
        'Vous n\'avez pas les droits pour modifier ces paramètres',
        HttpStatus.FORBIDDEN,
      );
    }
    const dep = await this.departementService.findByCode(depCode);
    const existing = await this.parametresRepository.findOne({
      where: {
        departement: {
          id: dep.id,
        },
      },
    });
    if (existing) {
      parametres.id = existing.id;
    }
    parametres.departement = dep;
    return this.parametresRepository.save(parametres);
  }
}
