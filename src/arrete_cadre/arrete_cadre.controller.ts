import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Post,
  Body,
  Patch,
} from '@nestjs/common';
import { ArreteCadreService } from './arrete_cadre.service';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { AuthenticatedGuard } from '../core/guards/authenticated.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import * as camelcaseKeys from 'camelcase-keys';
import { ArreteCadreDto } from './dto/arrete_cadre.dto';
import { Paginate, Paginated, PaginateQuery } from 'nestjs-paginate';
import { CreateUpdateArreteCadreDto } from './dto/create_update_arrete_cadre.dto';

@UseGuards(AuthenticatedGuard)
@Controller('arrete-cadre')
@ApiTags('Arrêtés Cadre')
export class ArreteCadreController {
  constructor(private readonly arreteCadreService: ArreteCadreService) {}

  @Get('/search')
  @ApiOperation({ summary: 'Retourne les arrêtés cadres paginés' })
  async findAll(
    @Req() req,
    @Paginate() query: PaginateQuery,
  ): Promise<Paginated<ArreteCadreDto>> {
    const paginated = await this.arreteCadreService.findAll(
      req.session.user,
      query,
    );
    return plainToInstance(
      Paginated<ArreteCadreDto>,
      camelcaseKeys(paginated, { deep: true }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retourne un arrêté cadre' })
  async findOne(@Param('id') id: string): Promise<ArreteCadreDto> {
    const arreteCadre = await this.arreteCadreService.findOne(+id);
    return plainToInstance(
      ArreteCadreDto,
      camelcaseKeys(arreteCadre, { deep: true }),
    );
  }

  @Post()
  @ApiOperation({ summary: "Création d'un arrêté cadre" })
  async create(
    @Body() createArreteCadreDto: CreateUpdateArreteCadreDto,
  ): Promise<ArreteCadreDto> {
    const arreteCadre =
      await this.arreteCadreService.create(createArreteCadreDto);
    return plainToInstance(
      ArreteCadreDto,
      camelcaseKeys(arreteCadre, { deep: true }),
    );
  }

  @Post(':id/publier')
  @ApiOperation({ summary: "Publication d'un arrêté cadre" })
  async publish(@Param('id') id: string): Promise<void> {
    return this.arreteCadreService.publish(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Edition d'un arrêté cadre" })
  async update(
    @Param('id') id: string,
    @Body() updateArreteCadreDto: CreateUpdateArreteCadreDto,
  ): Promise<ArreteCadreDto> {
    const arreteCadre = await this.arreteCadreService.update(
      +id,
      updateArreteCadreDto,
    );
    return plainToInstance(
      ArreteCadreDto,
      camelcaseKeys(arreteCadre, { deep: true }),
    );
  }

  //
  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.arreteCadreService.remove(+id);
  // }
}
