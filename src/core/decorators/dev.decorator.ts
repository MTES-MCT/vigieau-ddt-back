import { SetMetadata } from '@nestjs/common';
export const Dev = () => SetMetadata('devonly', true);
