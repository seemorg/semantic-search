import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class VectorSearchParamsDto {
  @IsString()
  @IsNotEmpty()
  q: string;

  @IsOptional()
  @IsBoolean()
  include_chapters: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @IsOptional()
  @IsBoolean()
  include_details: boolean = false;
}

export class VectorSearchManyParamsDto extends VectorSearchParamsDto {
  @IsString()
  @IsOptional()
  books: string;
}
