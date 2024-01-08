import { Controller, Get } from '@nestjs/common';
import { Dev } from './core/decorators/dev.decorator';

@Controller('app')
export class AppController {
  constructor() {}

  @Dev()
  @Get('__coverage__')
  public getCoverage() {
    if (global['__coverage__']) {
      return { coverage: global['__coverage__'] };
    }
  }
}
