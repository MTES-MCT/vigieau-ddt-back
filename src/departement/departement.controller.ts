import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../core/guards/authenticated.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import camelcaseKeys from 'camelcase-keys';
import { DepartementService } from './departement.service';
import { DepartementDto } from './dto/departement.dto';
import { Departement } from './entities/departement.entity';

@UseGuards(AuthenticatedGuard)
@Controller('departement')
@ApiTags('Département')
export class DepartementController {
  constructor(private readonly departementService: DepartementService) {}

  @Get()
  @ApiOperation({ summary: 'Retourne tout les départements' })
  async findAll(): Promise<DepartementDto[]> {
    const departements: Departement[] = await this.departementService.findAll();
    return plainToInstance(
      DepartementDto,
      camelcaseKeys(departements, { deep: true }),
    );
  }
}
