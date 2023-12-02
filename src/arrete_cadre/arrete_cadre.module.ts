import { Module } from '@nestjs/common';
import { ArreteCadreService } from './arrete_cadre.service';
import { ArreteCadreController } from './arrete_cadre.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArreteCadre } from './entities/arrete_cadre.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ArreteCadre])],
  controllers: [ArreteCadreController],
  providers: [ArreteCadreService],
})
export class ArreteCadreModule {}
