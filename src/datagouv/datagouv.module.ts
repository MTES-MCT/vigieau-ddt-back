import { Module } from '@nestjs/common';
import { DatagouvService } from './datagouv.service';

@Module({
  controllers: [],
  providers: [DatagouvService],
})
export class DatagouvModule {}
