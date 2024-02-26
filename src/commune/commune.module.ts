import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Commune } from './entities/commune.entity';
import { DepartementModule } from '../departement/departement.module';
import { CommuneService } from './commune.service';

@Module({
  imports: [TypeOrmModule.forFeature([Commune]), HttpModule, DepartementModule],
  providers: [CommuneService],
  exports: [],
  controllers: [],
})
export class CommuneModule {}
