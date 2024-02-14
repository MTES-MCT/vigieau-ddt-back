import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Restriction } from './entities/restriction.entity';
import { ArreteRestriction } from '../arrete_restriction/entities/arrete_restriction.entity';
import { UsageArreteRestrictionService } from '../usage_arrete_restriction/usage_arrete_restriction.service';

@Injectable()
export class RestrictionService {
  constructor(
    @InjectRepository(Restriction)
    private readonly restrictionRepository: Repository<Restriction>,
    private readonly usageArreteRestrictionService: UsageArreteRestrictionService,
  ) {}

  async updateAll(
    arreteRestriction: ArreteRestriction,
  ): Promise<Restriction[]> {
    const restrictionsId = arreteRestriction.restrictions.map((r) => r.id);
    // SUPPRESSION DES ANCIENNES RESTRICTIONS
    await this.restrictionRepository.delete({
      arreteRestriction: {
        id: arreteRestriction.id,
      },
      id: Not(In(restrictionsId)),
    });
    const restrictions: Restriction[] = arreteRestriction.restrictions.map(
      (r) => {
        // @ts-expect-error on ajoute seulement l'id
        r.arreteRestriction = { id: arreteRestriction.id };
        return r;
      },
    );
    const rToReturn: Restriction[] =
      await this.restrictionRepository.save(restrictions);
    await Promise.all(
      rToReturn.map(async (r) => {
        r.usagesArreteRestriction =
          await this.usageArreteRestrictionService.updateAll(r);
        return r;
      }),
    );
    return rToReturn;
  }
}
