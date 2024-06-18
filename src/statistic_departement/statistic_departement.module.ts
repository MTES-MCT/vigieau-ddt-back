import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticDepartement } from './entities/statistic_departement.entity';
import { StatisticDepartementService } from './statistic_departement.service';
import { Statistic } from '../statistic/entities/statistic.entity';
import { DepartementModule } from '../departement/departement.module';
import { AbonnementMail } from '../core/entities/abonnement_mail.entity';
import { ZoneAlerteModule } from '../zone_alerte/zone_alerte.module';
import { StatisticDepartementController } from './statistic_departement.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StatisticDepartement, Statistic, AbonnementMail]),
    DepartementModule,
    ZoneAlerteModule,
  ],
  providers: [StatisticDepartementService],
  exports: [StatisticDepartementService],
  controllers: [StatisticDepartementController],
})
export class StatisticDepartementModule {
}
