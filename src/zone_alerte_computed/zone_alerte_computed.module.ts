import { forwardRef, Module } from '@nestjs/common';
import { ZoneAlerteComputedService } from './zone_alerte_computed.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZoneAlerteComputed } from './entities/zone_alerte_computed.entity';
import { RestrictionModule } from '../restriction/restriction.module';
import { DepartementModule } from '../departement/departement.module';
import { ZoneAlerteModule } from '../zone_alerte/zone_alerte.module';
import { CommuneModule } from '../commune/commune.module';
import { ArreteRestrictionModule } from '../arrete_restriction/arrete_restriction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ZoneAlerteComputed]),
    RestrictionModule,
    DepartementModule,
    ZoneAlerteModule,
    CommuneModule,
    forwardRef(() => ArreteRestrictionModule)
  ],
  controllers: [],
  providers: [ZoneAlerteComputedService],
  exports: [ZoneAlerteComputedService],
})
export class ZoneAlerteComputedModule {}
