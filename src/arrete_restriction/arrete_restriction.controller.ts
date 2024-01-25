import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ArreteRestrictionService } from './arrete_restriction.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  Paginate,
  Paginated,
  PaginatedSwaggerDocs,
  PaginateQuery,
} from 'nestjs-paginate';
import { plainToInstance } from 'class-transformer';
import camelcaseKeys from 'camelcase-keys';
import {
  ArreteRestrictionDto,
  arreteRestrictionPaginateConfig,
} from './dto/arrete_restriction.dto';
import { AuthenticatedGuard } from '../core/guards/authenticated.guard';

@UseGuards(AuthenticatedGuard)
@Controller('arrete-restriction')
@ApiTags('Arrêtés de Restriction')
export class ArreteRestrictionController {
  constructor(
    private readonly arreteRestrictionService: ArreteRestrictionService,
  ) {}

  @Get('/search')
  @ApiOperation({ summary: 'Retourne les arrêtés de restrictions paginés' })
  @PaginatedSwaggerDocs(ArreteRestrictionDto, arreteRestrictionPaginateConfig)
  async findAll(
    @Req() req,
    @Paginate() query: PaginateQuery,
  ): Promise<Paginated<ArreteRestrictionDto>> {
    const paginated = await this.arreteRestrictionService.findAll(
      req.session.user,
      query,
    );
    return plainToInstance(
      Paginated<ArreteRestrictionDto>,
      camelcaseKeys(paginated, { deep: true }),
    );
  }

  @Get('')
  @ApiOperation({ summary: 'Retourne des arrêtés de restriction' })
  @ApiResponse({
    status: 201,
    type: [ArreteRestrictionDto],
  })
  async find(
    @Req() req,
    @Query('depCode') depCode?: string,
  ): Promise<ArreteRestrictionDto[]> {
    const arretesRestriction = await this.arreteRestrictionService.find(
      req.session.user,
      depCode,
    );
    return plainToInstance(
      ArreteRestrictionDto,
      camelcaseKeys(arretesRestriction, { deep: true }),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retourne un arrêté de restriction' })
  @ApiResponse({
    status: 201,
    type: ArreteRestrictionDto,
  })
  async findOne(@Param('id') id: string): Promise<ArreteRestrictionDto> {
    const arreteRestriction = await this.arreteRestrictionService.findOne(+id);
    return plainToInstance(
      ArreteRestrictionDto,
      camelcaseKeys(arreteRestriction, { deep: true }),
    );
  }
}
