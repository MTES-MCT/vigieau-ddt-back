import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Restriction } from '../restriction/entities/restriction.entity';
import { RestrictionService } from './restriction.service';
import { UsageArreteRestrictionModule } from '../usage_arrete_restriction/usage_arrete_restriction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restriction]),
    UsageArreteRestrictionModule,
  ],
  controllers: [],
  providers: [RestrictionService],
  exports: [RestrictionService],
})
export class RestrictionModule {}
