import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './env.service';
import { validateEnvironment } from './env.validation';

@Module({})
export class AppConfigModule {
  static forRoot(): DynamicModule {
    return {
      global: true,
      imports: [
        ConfigModule.forRoot({
          validate: validateEnvironment,
        }),
      ],
      module: AppConfigModule,
      providers: [AppConfigService],
      exports: [AppConfigService],
    };
  }
}
