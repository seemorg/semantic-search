import { IsEnum, IsOptional, IsPort, IsString } from 'class-validator';
import { Environment } from '../types/env';

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  // @IsString()
  // OPENAI_API_KEY: string;

  // @IsString()
  // QDRANT_URL: string;

  // @IsString()
  // QDRANT_API_KEY: string;

  // @IsString()
  // QDRANT_COLLECTION: string;

  @IsString()
  AZURE_EMBEDDINGS_DEPLOYMENT_NAME: string;

  @IsString()
  AZURE_LLM_DEPLOYMENT_NAME: string;

  @IsString()
  AZURE_RESOURCE_NAME: string;

  @IsString()
  AZURE_SECRET_KEY: string;

  @IsString()
  AZURE_SEARCH_ENDPOINT: string;

  @IsString()
  AZURE_SEARCH_KEY: string;

  @IsString()
  AZURE_KEYWORD_SEARCH_INDEX: string;

  @IsString()
  AZURE_VECTOR_SEARCH_INDEX: string;

  @IsPort()
  @IsOptional()
  PORT = '3000'; // default port
}
