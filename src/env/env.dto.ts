import { IsEnum, IsOptional, IsPort, IsString } from 'class-validator';
import { Environment } from '../types/env';

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  OPENAI_API_KEY: string;

  @IsString()
  CHROMA_PATH: string;

  @IsString()
  CHROMA_COLLECTION: string;

  @IsString()
  HELICONE_API_KEY: string;

  @IsPort()
  @IsOptional()
  PORT = '3000'; // default port
}
