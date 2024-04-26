import { forwardRef, Module } from '@nestjs/common';
import { DatagouvService } from './datagouv.service';
import { ArreteRestrictionModule } from '../arrete_restriction/arrete_restriction.module';
import { HttpModule } from '@nestjs/axios';
import { ZoneAlerteComputedModule } from '../zone_alerte_computed/zone_alerte_computed.module';

@Module({
  imports: [
    forwardRef(() => ArreteRestrictionModule),
    HttpModule,
    forwardRef(() => ZoneAlerteComputedModule),
  ],
  controllers: [],
  providers: [DatagouvService],
  exports: [DatagouvService],
})
export class DatagouvModule {
}
