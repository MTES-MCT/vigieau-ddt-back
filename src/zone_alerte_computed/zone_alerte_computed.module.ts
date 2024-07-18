import { forwardRef, Module } from '@nestjs/common';
import { ZoneAlerteComputedService } from './zone_alerte_computed.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZoneAlerteComputed } from './entities/zone_alerte_computed.entity';
import { RestrictionModule } from '../restriction/restriction.module';
import { DepartementModule } from '../departement/departement.module';
import { ZoneAlerteModule } from '../zone_alerte/zone_alerte.module';
import { CommuneModule } from '../commune/commune.module';
import { ArreteRestrictionModule } from '../arrete_restriction/arrete_restriction.module';
import { SharedModule } from '../shared/shared.module';
import { DatagouvModule } from '../datagouv/datagouv.module';
import { ZoneAlerteComputedHistoricService } from './zone_alerte_computed_historic.service';
import { StatisticModule } from '../statistic/statistic.module';
import { ZoneAlerteComputedHistoric } from './entities/zone_alerte_computed_historic.entity';
import { StatisticDepartementModule } from '../statistic_departement/statistic_departement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ZoneAlerteComputed, ZoneAlerteComputedHistoric]),
    RestrictionModule,
    DepartementModule,
    ZoneAlerteModule,
    CommuneModule,
    forwardRef(() => ArreteRestrictionModule),
    SharedModule,
    RestrictionModule,
    forwardRef(() => DatagouvModule),
    StatisticModule,
    forwardRef(() => StatisticDepartementModule),
  ],
  controllers: [],
  providers: [ZoneAlerteComputedService, ZoneAlerteComputedHistoricService],
  exports: [ZoneAlerteComputedService],
})
export class ZoneAlerteComputedModule {
}
