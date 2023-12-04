import { Injectable } from '@nestjs/common';
import { FindOptionsWhere, Repository } from 'typeorm';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';

@Injectable()
export class ArreteCadreService {
  constructor(
    @InjectRepository(ArreteCadre)
    private readonly arreteCadreRepository: Repository<ArreteCadre>,
  ) {}

  findAll(curentUser: User): Promise<ArreteCadre[]> {
    const where: FindOptionsWhere<ArreteCadre> =
      curentUser.role === 'mte'
        ? {}
        : {
            zones_alerte: {
              departement: {
                code: curentUser.role_departement,
              },
            },
          };
    return this.arreteCadreRepository.find({
      relations: ['zones_alerte', 'zones_alerte.departement'],
      where,
    });
  }

  findOne(id: number) {
    return this.arreteCadreRepository.findOne({ where: { id } });
  }

  // create(createArreteCadreDto: CreateArreteCadreDto) {
  //   return 'This action adds a new arreteCadre';
  // }
  //
  // update(id: number, updateArreteCadreDto: UpdateArreteCadreDto) {
  //   return `This action updates a #${id} arreteCadre`;
  // }
  //
  // remove(id: number) {
  //   return `This action removes a #${id} arreteCadre`;
  // }
}
