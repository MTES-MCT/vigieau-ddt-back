import { forwardRef, Module } from '@nestjs/common';
import { ZoneAlerteService } from './zone_alerte.service';
import { ZoneAlerteController } from './zone_alerte.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZoneAlerte } from './entities/zone_alerte.entity';
import { ArreteCadreModule } from '../arrete_cadre/arrete_cadre.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ZoneAlerte]),
    forwardRef(() => ArreteCadreModule),
  ],
  controllers: [ZoneAlerteController],
  providers: [ZoneAlerteService],
  exports: [ZoneAlerteService],
})
export class ZoneAlerteModule {}
