import { forwardRef, Module } from '@nestjs/common';
import { DatagouvService } from './datagouv.service';
import { ArreteRestrictionModule } from '../arrete_restriction/arrete_restriction.module';
import { HttpModule } from '@nestjs/axios';
import { ZoneAlerteComputedModule } from '../zone_alerte_computed/zone_alerte_computed.module';
import { SharedModule } from '../shared/shared.module';
import { ArreteCadreModule } from '../arrete_cadre/arrete_cadre.module';
import { DepartementModule } from '../departement/departement.module';

@Module({
  imports: [
    forwardRef(() => ArreteRestrictionModule),
    forwardRef(() => ArreteCadreModule),
    HttpModule,
    forwardRef(() => ZoneAlerteComputedModule),
    SharedModule,
    DepartementModule,
  ],
  controllers: [],
  providers: [DatagouvService],
  exports: [DatagouvService],
})
export class DatagouvModule {
}
