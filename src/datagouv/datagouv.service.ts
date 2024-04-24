import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DatagouvService {
  constructor() {
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  updateDatagouvData() {
    console.log('Updating data from data.gouv.fr');
  }
}
