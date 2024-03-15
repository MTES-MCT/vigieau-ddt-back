import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { UsageArreteRestriction } from '../usage_arrete_restriction/entities/usage_arrete_restriction.entity';
import { Restriction } from '../restriction/entities/restriction.entity';

@Injectable()
export class UsageArreteRestrictionService {
  constructor(
    @InjectRepository(UsageArreteRestriction)
    private readonly usageArreteRestrictionRepository: Repository<UsageArreteRestriction>,
  ) {
  }

  async updateAll(restriction: Restriction): Promise<UsageArreteRestriction[]> {
    const usagesId = restriction.usagesArreteRestriction
      .map((u) => u.usage.id)
      .flat();
    // SUPPRESSION DES ANCIENS USAGES
    await this.usageArreteRestrictionRepository.delete({
      restriction: {
        id: restriction.id,
      },
      usage: {
        id: Not(In(usagesId)),
      },
    });
    const usagesArreteRestriction: UsageArreteRestriction[] =
      restriction.usagesArreteRestriction.map((u) => {
        // @ts-expect-error on ajoute seulement l'id
        u.restriction = { id: restriction.id };
        return u;
      });
    return this.usageArreteRestrictionRepository.save(usagesArreteRestriction);
  }

  async deleteUsagesByArreteCadreId(usagesId: number[], acId: number) {
    if (usagesId.length < 1) {
      return;
    }
    const usagesArreteRestrictionsId =
      await this.usageArreteRestrictionRepository
        .createQueryBuilder('usageArreteRestriction')
        .select('usageArreteRestriction.id')
        .leftJoin('usageArreteRestriction.restriction', 'restriction')
        .leftJoin('restriction.arreteRestriction', 'arreteRestriction')
        .leftJoin('arreteRestriction.arretesCadre', 'arretesCadre')
        .leftJoin('usageArreteRestriction.usage', 'usage')
        .where('arretesCadre.id = :acId', { acId: acId })
        .andWhere('arreteRestriction.statut != :statut', { statut: 'abroge' })
        .andWhere('usage.id IN (:...usagesId)', { usagesId: usagesId })
        .getMany();
    return this.usageArreteRestrictionRepository.delete({
      id: In(usagesArreteRestrictionsId.map((u) => u.id)),
    });
  }

  // findByArreteCadre(arreteCadreId: number) {
  //   return this.usageArreteRestrictionRepository.find({
  //     select: {
  //       id: true,
  //       concerneParticulier: true,
  //       concerneEntreprise: true,
  //       concerneCollectivite: true,
  //       concerneExploitation: true,
  //       concerneEso: true,
  //       concerneEsu: true,
  //       concerneAep: true,
  //       descriptionVigilance: true,
  //       descriptionAlerte: true,
  //       descriptionAlerteRenforcee: true,
  //       descriptionCrise: true,
  //       usage: {
  //         id: true,
  //         nom: true,
  //         thematique: {
  //           id: true,
  //           nom: true,
  //         },
  //       },
  //     },
  //     relations: ['usage', 'usage.thematique'],
  //     where: {
  //       arreteCadre: {
  //         id: arreteCadreId,
  //       },
  //     },
  //   });
  // }
}
