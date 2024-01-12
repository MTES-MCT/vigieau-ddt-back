import { Injectable } from '@nestjs/common';
import { RegleauLogger } from '../../logger/regleau.logger';
import { DeleteObjectCommand, S3 } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import process from 'node:process';

@Injectable()
export class S3Service {
  private readonly logger = new RegleauLogger('S3Service');
  private readonly client = new S3({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
  });
  constructor() {}

  async uploadFile(file: Express.Multer.File, prefix: string = '') {
    const { originalname } = file;

    return await this.s3_upload(
      file.buffer,
      process.env.S3_BUCKET,
      (process.env.S3_PREFIX || '') + prefix + originalname,
      file.mimetype,
    );
  }

  async deleteFile(fileUrl: string) {
    const client = this.client;
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: fileUrl.replace(process.env.S3_VHOST, ''),
    };
    try {
      await client.send(new DeleteObjectCommand(params));
    } catch (e) {
      this.logger.error("Erreur lors de la suppression d'un fichier", e);
    }
  }

  async s3_upload(file, bucket, name, mimetype) {
    const client = this.client;
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: String(name),
        Body: file,
        ACL: 'public-read',
        ContentType: mimetype,
      },
    });

    try {
      return await upload.done();
    } catch (e) {
      this.logger.error("Erreur lors de l'upload d'un fichier", e);
    }
  }
}
