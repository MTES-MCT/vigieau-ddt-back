import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ArreteRestrictionService } from './arrete_restriction.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
}
