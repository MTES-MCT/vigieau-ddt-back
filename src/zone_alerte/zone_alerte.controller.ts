import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ZoneAlerteService } from './zone_alerte.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZoneAlerte } from './entities/zone_alerte.entity';
import { plainToInstance } from 'class-transformer';
import camelcaseKeys from 'camelcase-keys';
import { ZoneAlerteDto, ZoneAlertGeomDto } from './dto/zone_alerte.dto';
import { AuthenticatedGuard } from '../core/guards/authenticated.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../core/guards/roles.guard';
import { Roles } from '../core/decorators/roles.decorator';
import { ZoneAlerteVerificationDto } from './dto/zone_alerte_verification.dto';

@UseGuards(AuthenticatedGuard)
@Controller('zone-alerte')
@ApiTags("Zones d'alertes")
export class ZoneAlerteController {
  constructor(private readonly zoneAlerteService: ZoneAlerteService) {}

  @Get(':departementCode')
  @ApiOperation({
    summary: "Retourne toute les zones d'alerte d'un département",
  })
  @ApiResponse({
    status: 201,
    type: [ZoneAlerteDto],
  })
  async findByDepartement(
    @Param('departementCode') departementCode: string,
  ): Promise<ZoneAlerteDto[]> {
    const zonesAlerte: ZoneAlerte[] =
      await this.zoneAlerteService.findByDepartement(departementCode);
    return plainToInstance(
      ZoneAlerteDto,
      camelcaseKeys(zonesAlerte, { deep: true }),
    );
  }

  @Get('/arrete-cadre/:id')
  @ApiOperation({
    summary:
      "Retourne toute les zones d'alerte avec leurs géométries d'un arrêté cadre",
  })
  @ApiResponse({
    status: 201,
    type: [ZoneAlertGeomDto],
  })
  async findByArreteCadreId(
    @Param('id') arId: string,
  ): Promise<ZoneAlertGeomDto[]> {
    const zonesAlerte: ZoneAlerte[] =
      await this.zoneAlerteService.findByArreteCadre(+arId);
    return plainToInstance(
      ZoneAlertGeomDto,
      camelcaseKeys(zonesAlerte, { deep: true }),
    );
  }
}
