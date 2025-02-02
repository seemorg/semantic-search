import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum SearchType {
  SEMANTIC = 'semantic',
  KEYWORD = 'keyword',
}

export class SearchParamsDto {
  @IsString()
  @IsNotEmpty()
  q: string;

  @IsString()
  bookId: string;

  @IsString()
  versionId: string;

  @IsOptional()
  @IsEnum(SearchType)
  type: SearchType = SearchType.SEMANTIC;

  @IsOptional()
  @IsNumber()
  page: number = 1;

  @IsOptional()
  @IsNumber()
  limit: number = 10;
}
