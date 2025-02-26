import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from 'src/env/env.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.header('Authorization');

    return (
      !!apiKey &&
      apiKey.replace('Bearer ', '') === this.config.get('ANSARI_API_KEY')
    );
  }
}

export const UseApiKey = () => UseGuards(ApiKeyGuard);
