import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ArreteCadreService } from './arrete_cadre.service';
import { ArreteCadre } from './entities/arrete_cadre.entity';
import { AuthenticatedGuard } from '../core/guards/authenticated.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import * as camelcaseKeys from 'camelcase-keys';
import { ArreteCadreDto } from './dto/arrete_cardre.dto';

@UseGuards(AuthenticatedGuard)
@Controller('arrete_cadre')
@ApiTags('Arrêtés Cadre')
export class ArreteCadreController {
  constructor(private readonly arreteCadreService: ArreteCadreService) {}

  @Get()
  @ApiOperation({ summary: 'Retourne tout les arrêtés cadre' })
  async findAll(@Req() req): Promise<ArreteCadreDto[]> {
    const arretesCadre: ArreteCadre[] = await this.arreteCadreService.findAll(
      req.session.user,
    );
    return plainToInstance(
      ArreteCadreDto,
      camelcaseKeys(arretesCadre, { deep: true }),
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

  // @Post()
  // create(@Body() createArreteCadreDto: CreateArreteCadreDto) {
  //   return this.arreteCadreService.create(createArreteCadreDto);
  // }
  //
  // @Patch(':id')
  // update(
  //   @Param('id') id: string,
  //   @Body() updateArreteCadreDto: UpdateArreteCadreDto,
  // ) {
  //   return this.arreteCadreService.update(+id, updateArreteCadreDto);
  // }
  //
  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.arreteCadreService.remove(+id);
  // }
}
