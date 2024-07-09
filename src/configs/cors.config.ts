// import { Environment } from 'src/types/env';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppConfigService } from '../env/env.service';

export const corsOptionsFactory = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _configService: AppConfigService,
): CorsOptions => {
  // const isDev = configService.get('NODE_ENV') === Environment.Development;

  return {
    // * on dev, otherwise *.usul.ai
    // origin: isDev ? '*' : /\*?usul\.ai$/,
    origin: '*',
    // origin: '*',
  };
};
