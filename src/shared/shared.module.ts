import { S3Service } from './services/s3.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [S3Service],
  exports: [S3Service],
})
export class SharedModule {}
