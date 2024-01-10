import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  Post,
  Body,
  Patch,
  Delete,
} from '@nestjs/common';
import { ArreteCadreService } from './arrete_cadre.service';
import { AuthenticatedGuard } from '../core/guards/authenticated.guard';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import camelcaseKeys from 'camelcase-keys';
import {
  ArreteCadreDto,
  arreteCadrePaginateConfig,
} from './dto/arrete_cadre.dto';
import {
  Paginate,
  Paginated,
  PaginatedSwaggerDocs,
  PaginateQuery,
} from 'nestjs-paginate';
import { CreateUpdateArreteCadreDto } from './dto/create_update_arrete_cadre.dto';
import { Dev } from '../core/decorators/dev.decorator';
import { Public } from '../core/decorators/public.decorator';
import { DeleteResult } from 'typeorm';
import { PublishArreteCadreDto } from './dto/publish_arrete_cadre.dto';

@UseGuards(AuthenticatedGuard)
@Controller('arrete-cadre')
@ApiTags('Arrêtés Cadre')
export class ArreteCadreController {
  constructor(private readonly arreteCadreService: ArreteCadreService) {}

  @Get('/search')
  @ApiOperation({ summary: 'Retourne les arrêtés cadres paginés' })
  @PaginatedSwaggerDocs(ArreteCadreDto, arreteCadrePaginateConfig)
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
  @ApiResponse({
    status: 201,
    type: ArreteCadreDto,
  })
  async findOne(@Param('id') id: string): Promise<ArreteCadreDto> {
    const arreteCadre = await this.arreteCadreService.findOne(+id);
    return plainToInstance(
      ArreteCadreDto,
      camelcaseKeys(arreteCadre, { deep: true }),
    );
  }

  @Post()
  @ApiOperation({ summary: "Création d'un arrêté cadre" })
  @ApiResponse({
    status: 201,
    type: ArreteCadreDto,
  })
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
  async publish(
    @Req() req,
    @Param('id') id: string,
    @Body() publishArreteCadreDto: PublishArreteCadreDto,
  ): Promise<ArreteCadreDto> {
    const arreteCadre = await this.arreteCadreService.publish(
      +id,
      publishArreteCadreDto,
      req.session.user,
    );
    return plainToInstance(
      ArreteCadreDto,
      camelcaseKeys(arreteCadre, { deep: true }),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: "Edition d'un arrêté cadre" })
  @ApiResponse({
    status: 201,
    type: ArreteCadreDto,
  })
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() updateArreteCadreDto: CreateUpdateArreteCadreDto,
  ): Promise<ArreteCadreDto> {
    const arreteCadre = await this.arreteCadreService.update(
      +id,
      updateArreteCadreDto,
      req.session.user,
    );
    return plainToInstance(
      ArreteCadreDto,
      camelcaseKeys(arreteCadre, { deep: true }),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: "Suppression d'un arrêté cadre" })
  remove(@Req() req, @Param('id') id: string) {
    return this.arreteCadreService.remove(+id, req.session.user);
  }

  @Post('populateTestData')
  @Public()
  @Dev()
  @ApiOperation({
    summary: 'Génération des données nécessaires pour les tests',
  })
  async populateTestData(): Promise<void> {
    return this.arreteCadreService.populateTestData();
  }

  @Post('clearTestData')
  @Public()
  @Dev()
  @ApiOperation({ summary: 'Suppression des données générées par les tests' })
  async clearTestData(): Promise<DeleteResult> {
    return this.arreteCadreService.removeTestData();
  }
}
