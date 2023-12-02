import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ArreteCadreService } from './arrete_cadre.service';
import { CreateArreteCadreDto } from './dto/create-arrete_cadre.dto';
import { UpdateArreteCadreDto } from './dto/update-arrete_cadre.dto';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { AuthenticatedGuard } from '../core/guards/authenticated.guard';
import { ApiTags } from '@nestjs/swagger';

@UseGuards(AuthenticatedGuard)
@Controller('arrete_cadre')
@ApiTags('Arrêtés Cadre')
export class ArreteCadreController {
  constructor(private readonly arreteCadreService: ArreteCadreService) {}

  @Post()
  create(@Body() createArreteCadreDto: CreateArreteCadreDto) {
    return this.arreteCadreService.create(createArreteCadreDto);
  }

  @Get()
  findAll(): Promise<ArreteCadre[]> {
    return this.arreteCadreService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.arreteCadreService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateArreteCadreDto: UpdateArreteCadreDto,
  ) {
    return this.arreteCadreService.update(+id, updateArreteCadreDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.arreteCadreService.remove(+id);
  }
}
