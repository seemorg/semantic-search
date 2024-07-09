import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { EnvironmentVariables } from './env.dto';

@Injectable()
export class AppConfigService extends ConfigService<EnvironmentVariables> {}
