import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { ArreteCadreModule } from './arrete_cadre/arrete_cadre.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './core/entities/session.entity';
import { UserModule } from './user/user.module';
import { ZoneAlerteModule } from './zone_alerte/zone_alerte.module';
import { DataSource } from 'typeorm';
import { Region } from './core/entities/region.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { DepartementModule } from './departement/departement.module';
import { UsageModule } from './usage/usage.module';
import { ThematiqueModule } from './thematique/thematique.module';
import { AdminModule } from './admin.module';
import { ArreteRestrictionModule } from './arrete_restriction/arrete_restriction.module';
import { AppController } from './app.controller';
import { LoggerModule } from './logger/logger.module';
import { LoggerInterceptor } from './core/interceptor/logger.interceptor';
import { SharedModule } from './shared/shared.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { CommuneModule } from './commune/commune.module';
import { RestrictionModule } from './restriction/restriction.module';
import { BassinVersantModule } from './bassin_versant/bassin_versant.module';
import { AbonnementMail } from './core/entities/abonnement_mail.entity';
import { DatagouvModule } from './datagouv/datagouv.module';

// @ts-ignore
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: `postgres://${process.env.DATABASE_USER}:${
          process.env.DATABASE_PASSWORD
        }@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${
          process.env.DATABASE_NAME
        }?${process.env.DATABASE_SSL_CERT ? 'sslmode=require' : ''}`,
        entities: [`${__dirname}/**/*.entity{.ts,.js}`],
        logging: ['test', 'dev', 'review', 'local'].includes(
          process.env.NODE_ENV,
        )
          ? ['error', 'schema']
          : false,
        migrations: [`${__dirname}/migrations/**/*{.ts,.js}`],
        cli: {
          migrationsDir: 'src/migrations',
        },
        synchronize: false,
        maxQueryExecutionTime: 1000,
        ssl: process.env.NODE_ENV !== 'local',
        extra:
          process.env.NODE_ENV !== 'local'
            ? {
                ssl: {
                  rejectUnauthorized: false,
                },
              }
            : {},
      }),
      dataSourceFactory: async (options) => {
        const dataSource = await new DataSource(options).initialize();
        await dataSource.synchronize();
        await dataSource.runMigrations();
        return dataSource;
      },
    }),
    TypeOrmModule.forFeature([Session, Region, AbonnementMail]),
    // Rate limit, 300 requêtes maximum toutes les 15min par IP
    ThrottlerModule.forRoot([
      {
        ttl: 60 * 15,
        limit: 300,
      },
    ]),
    MailerModule.forRoot({
      transport: {
        host: `${process.env.MAIL_HOST}`,
        port: Number(`${process.env.MAIL_PORT}`),
        secure: true,
        auth: {
          user: `${process.env.MAIL_USER}`,
          pass: `${process.env.MAIL_PASSWORD}`,
        },
        tls: {
          // do not fail on invalid certs
          rejectUnauthorized: false,
        },
      },
      preview: process.env.NODE_ENV === 'local',
      template: {
        dir: __dirname + '/mail_templates',
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
    AdminModule,
    HealthModule,
    ArreteCadreModule,
    AuthModule,
    UserModule,
    ZoneAlerteModule,
    ScheduleModule.forRoot(),
    DepartementModule,
    UsageModule,
    ThematiqueModule,
    ArreteRestrictionModule,
    LoggerModule,
    SharedModule,
    CommuneModule,
    RestrictionModule,
    BassinVersantModule,
    DatagouvModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggerInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
