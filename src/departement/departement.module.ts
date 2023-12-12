import { Module } from '@nestjs/common';
import { DepartementService } from './departement.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Departement } from './entities/departement.entity';
import { HttpModule } from '@nestjs/axios';
import { DepartementController } from './departement.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Departement]), HttpModule],
  providers: [DepartementService],
  exports: [DepartementService],
  controllers: [DepartementController],
})
export class DepartementModule {}
