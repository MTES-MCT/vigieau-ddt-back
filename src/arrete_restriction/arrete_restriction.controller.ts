import { Controller, Get, Req } from '@nestjs/common';
import { ArreteRestrictionService } from './arrete_restriction.service';
import { ApiOperation } from '@nestjs/swagger';
import { Paginate, Paginated, PaginateQuery } from 'nestjs-paginate';
import { plainToInstance } from 'class-transformer';
import camelcaseKeys from 'camelcase-keys';
import { ArreteRestrictionDto } from './dto/arrete_restriction.dto';

@Controller('arrete-restriction')
export class ArreteRestrictionController {
  constructor(
    private readonly arreteRestrictionService: ArreteRestrictionService,
  ) {}

  @Get('/search')
  @ApiOperation({ summary: 'Retourne les arrêtés de restrictions paginés' })
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
