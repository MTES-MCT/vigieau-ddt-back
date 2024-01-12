import { Module } from '@nestjs/common';
import { ArreteCadreService } from './arrete_cadre.service';
import { ArreteCadreController } from './arrete_cadre.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { UsageArreteCadreModule } from '../usage_arrete_cadre/usage_arrete_cadre.module';
import { ArreteRestrictionModule } from '../arrete_restriction/arrete_restriction.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArreteCadre]),
    UsageArreteCadreModule,
    ArreteRestrictionModule,
    SharedModule,
  ],
  controllers: [ArreteCadreController],
  providers: [ArreteCadreService],
})
export class ArreteCadreModule {}
