import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageArreteRestriction } from './entities/usage_arrete_restriction.entity';
import { UsageArreteRestrictionService } from './usage_arrete_restriction.service';

@Module({
  imports: [TypeOrmModule.forFeature([UsageArreteRestriction])],
  controllers: [],
  providers: [UsageArreteRestrictionService],
  exports: [UsageArreteRestrictionService],
})
export class UsageArreteRestrictionModule {}
