import { Controller, Get, Req } from '@nestjs/common';
import { UsageFeedbackService } from './usage_feedback.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsageFeedback } from './entities/usage_feedback.entity';

@Controller('usage_feedback')
export class UsageFeedbackController {
  constructor(private readonly usageFeedbackService: UsageFeedbackService) {
  }

  @Get()
  @ApiOperation({
    summary: 'Retourne tout les feedbacks suivant le rôle de l\'utilisateur',
  })
  @ApiResponse({
    status: 201,
    type: [UsageFeedback],
  })
  async findAll(@Req() req): Promise<UsageFeedback[]> {
    return this.usageFeedbackService.findAll(req.session.user)
  }
}
