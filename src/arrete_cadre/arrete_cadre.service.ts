import { Injectable } from '@nestjs/common';
import { CreateArreteCadreDto } from './dto/create-arrete_cadre.dto';
import { UpdateArreteCadreDto } from './dto/update-arrete_cadre.dto';
import { Repository } from 'typeorm';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class ArreteCadreService {
  constructor(
    @InjectRepository(ArreteCadre)
    private readonly arreteCadreRepository: Repository<ArreteCadre>,
  ) {}

  create(createArreteCadreDto: CreateArreteCadreDto) {
    return 'This action adds a new arreteCadre';
  }

  findAll(): Promise<ArreteCadre[]> {
    return this.arreteCadreRepository.find();
  }

  findOne(id: number) {
    return `This action returns a #${id} arreteCadre`;
  }

  update(id: number, updateArreteCadreDto: UpdateArreteCadreDto) {
    return `This action updates a #${id} arreteCadre`;
  }

  remove(id: number) {
    return `This action removes a #${id} arreteCadre`;
  }
}
