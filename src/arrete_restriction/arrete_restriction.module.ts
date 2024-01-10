import { Module } from '@nestjs/common';
import { ArreteRestrictionService } from './arrete_restriction.service';
import { ArreteRestrictionController } from './arrete_restriction.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArreteRestriction } from './entities/arrete_restriction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ArreteRestriction])],
  controllers: [ArreteRestrictionController],
  providers: [ArreteRestrictionService],
  exports: [ArreteRestrictionService],
})
export class ArreteRestrictionModule {}
