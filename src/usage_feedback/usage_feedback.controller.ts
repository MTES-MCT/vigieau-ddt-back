import { Controller } from '@nestjs/common';
import { UsageFeedbackService } from './usage_feedback.service';

@Controller('usage-feedback')
export class UsageFeedbackController {
  constructor(private readonly usageFeedbackService: UsageFeedbackService) {}
}
