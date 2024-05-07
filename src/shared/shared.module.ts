import { S3Service } from './services/s3.service';
import { Module } from '@nestjs/common';
import { MailService } from './services/mail.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  providers: [S3Service, MailService],
  exports: [S3Service, MailService],
})
export class SharedModule {}
