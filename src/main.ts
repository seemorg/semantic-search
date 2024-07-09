import { config } from 'dotenv';
config();

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as morgan from 'morgan';
import { AppModule } from './app.module';
import { AppConfigService } from './env/env.service';
import { corsOptionsFactory } from './configs/cors.config';
import { HttpExceptionFilter } from './shared/http-exception.filter';
import { setLlamaindexSettings } from './shared/llamaindex';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  setLlamaindexSettings();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      // whitelist: true, // will remove unvalidated fields
    }),
  );

  const configService = app.get<AppConfigService>(ConfigService);
  logger.log(configService.get('NODE_ENV'));

  app.enableCors(corsOptionsFactory(configService));

  app.use(helmet());
  app.use(morgan('tiny'));

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = configService.get('PORT');

  await app.listen(port);

  logger.log(`App started on: ${await app.getUrl()}`);
}

bootstrap();
