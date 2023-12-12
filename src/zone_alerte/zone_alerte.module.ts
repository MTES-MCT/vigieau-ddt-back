import { Module } from '@nestjs/common';
import { ZoneAlerteService } from './zone_alerte.service';
import { ZoneAlerteController } from './zone_alerte.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZoneAlerte } from './entities/zone_alerte.entity';
import { DepartementModule } from '../departement/departement.module';

@Module({
  imports: [TypeOrmModule.forFeature([ZoneAlerte]), DepartementModule],
  controllers: [ZoneAlerteController],
  providers: [ZoneAlerteService],
})
export class ZoneAlerteModule {}
