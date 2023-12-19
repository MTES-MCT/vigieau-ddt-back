import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usage } from './entities/usage.entity';
import { User } from '../user/entities/user.entity';
import { CreateUsageDto } from './dto/create_usage.dto';

@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(Usage)
    private readonly usageRepository: Repository<Usage>,
  ) {}

  findOne(nom: string): Promise<Usage> {
    return this.usageRepository.findOne({ where: { nom } });
  }

  findAll(curentUser: User): Promise<Usage[]> {
    return this.usageRepository
      .createQueryBuilder('usage')
      .select()
      .leftJoinAndSelect('usage.thematique', 'thematique')
      .leftJoin('usage.usagesArreteCadre', 'usagesArreteCadre')
      .leftJoin('usagesArreteCadre.arreteCadre', 'arreteCadre')
      .leftJoin('arreteCadre.departements', 'departements')
      .where('arreteCadre.statut IN (:...statut)', {
        statut: ['publie', 'a_valider'],
      })
      .andWhere('departements.code = :code_dep', {
        code_dep:
          curentUser.role === 'mte' ? '34' : curentUser.role_departement,
      })
      .getMany();
  }

  async create(usage: CreateUsageDto): Promise<Usage> {
    const usageExists = await this.findOne(usage.nom);
    if (!usageExists) {
      return this.usageRepository.save(usage);
    }
    return usageExists;
  }
}
