import { Controller } from '@nestjs/common';
import { DepartementService } from './departement.service';

@Controller('departement')
export class DepartementController {
  constructor(private readonly departementService: DepartementService) {}
}
