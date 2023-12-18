import { Get, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../core/guards/authenticated.guard';
import { Controller } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsageService } from './usage.service';
import { plainToInstance } from 'class-transformer';
import * as camelcaseKeys from 'camelcase-keys';
import { UsageDto } from './dto/usage.dto';
import { Usage } from './entities/usage.entity';

@UseGuards(AuthenticatedGuard)
@Controller('usage')
@ApiTags('Usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  @ApiOperation({
    summary: "Retourne tout les usages suivant les droits de l'utilisateur",
  })
  async findAll(@Req() req): Promise<UsageDto[]> {
    const usages: Usage[] = await this.usageService.findAll(req.session.user);
    return plainToInstance(UsageDto, camelcaseKeys(usages, { deep: true }));
  }
}
