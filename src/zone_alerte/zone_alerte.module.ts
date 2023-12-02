import { Module } from '@nestjs/common';
import { ZoneAlerteService } from './zone_alerte.service';
import { ZoneAlerteController } from './zone_alerte.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZoneAlerte } from './entities/zone_alerte.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ZoneAlerte])],
  controllers: [ZoneAlerteController],
  providers: [ZoneAlerteService],
})
export class ZoneAlerteModule {}
