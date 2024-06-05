import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageFeedback } from './entities/usage_feedback.entity';

@Injectable()
export class UsageFeedbackService {
  constructor(@InjectRepository(UsageFeedback)
              private readonly usageFeedbackRepository: Repository<UsageFeedback>) {
  }

  findAll(currentUser: any): any {
    const whereClause = {
      isView: false,
    };
    if (currentUser && currentUser.role !== 'mte') {
      whereClause['usage'] = {
        restriction: {
          arreteRestriction: {
            departement: {
              code: currentUser.role_departement,
            },
          },
        },
      };
    }

    return this.usageFeedbackRepository.find({
      select: {
        id: true,
        createdAt: true,
        feedback: true,
        usage: {
          id: true,
          nom: true,
          thematique: {
            id: true,
            nom: true,
          },
          restriction: {
            id: true,
            arreteRestriction: {
              id: true,
              departement: {
                code: true,
              },
            },
          },
        },
      },
      relations: ['usage', 'usage.thematique', 'usage.restriction', 'usage.restriction.arreteRestriction', 'usage.restriction.arreteRestriction.departement'],
      where: whereClause,
    });
  }
}
