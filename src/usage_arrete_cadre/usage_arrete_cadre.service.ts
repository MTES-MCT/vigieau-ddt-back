import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { UsageArreteCadre } from './entities/usage_arrete_cadre.entity';
import { ArreteCadre } from '../arrete_cadre/entities/arrete_cadre.entity';

@Injectable()
export class UsageArreteCadreService {
  constructor(
    @InjectRepository(UsageArreteCadre)
    private readonly usageArreteCadreRepository: Repository<UsageArreteCadre>,
  ) {}

  async updateAll(arreteCadre: ArreteCadre) {
    const usagesId = arreteCadre.usagesArreteCadre
      .map((u) => u.usage.id)
      .flat();
    // SUPPRESSION DES ANCIENS USAGES
    await this.usageArreteCadreRepository.delete({
      arreteCadre: {
        id: arreteCadre.id,
      },
      usage: {
        id: Not(In(usagesId)),
      },
    });
    const usagesArreteCadre: UsageArreteCadre[] =
      arreteCadre.usagesArreteCadre.map((u) => {
        // @ts-expect-error on ajoute seulement l'id
        u.arreteCadre = { id: arreteCadre.id };
        return u;
      });
    return this.usageArreteCadreRepository.save(usagesArreteCadre);
  }

  findByArreteCadre(arreteCadreId: number) {
    return this.usageArreteCadreRepository.find({
      select: {
        id: true,
        concerneParticulier: true,
        concerneEntreprise: true,
        concerneCollectivite: true,
        concerneExploitation: true,
        descriptionVigilance: true,
        descriptionAlerte: true,
        descriptionAlerteRenforcee: true,
        descriptionCrise: true,
        usage: {
          id: true,
          nom: true,
          thematique: {
            id: true,
            nom: true,
          },
        },
      },
      relations: ['usage', 'usage.thematique'],
      where: {
        arreteCadre: {
          id: arreteCadreId,
        },
      },
    });
  }
}
