import { Module } from '@nestjs/common';
import { UsageArreteCadreService } from './usage_arrete_cadre.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageArreteCadre } from './entities/usage_arrete_cadre.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UsageArreteCadre])],
  controllers: [],
  providers: [UsageArreteCadreService],
  exports: [UsageArreteCadreService],
})
export class UsageArreteCadreModule {}
