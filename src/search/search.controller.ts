import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchParamsDto } from './dto/search-params.dto';
import {
  VectorSearchManyParamsDto,
  VectorSearchParamsDto,
} from './dto/vector-search-params.dto';
import { UseApiKey } from 'src/shared/api-key.guard';

@Controller('/')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('/search')
  async search(@Query() params: SearchParamsDto) {
    const results = await this.searchService.searchWithinBook(params);
    return results;
  }

  @Get('/v1/vector-search/:bookId/:versionId')
  @UseApiKey()
  async vectorSearch(
    @Param('bookId') bookId: string,
    @Param('versionId') versionId: string,
    @Query() params: VectorSearchParamsDto,
  ) {
    const results = await this.searchService.search(params, 'vector', [
      {
        id: bookId,
        versionId,
      },
    ]);

    return results;
  }

  @Get('/v1/keyword-search')
  @UseApiKey()
  async keywordSearchMany(@Query() params: VectorSearchManyParamsDto) {
    const results = await this.searchService.search(
      params,
      'text',
      params.books,
    );

    return results;
  }

  @Get('/v1/vector-search')
  @UseApiKey()
  async vectorSearchMany(@Query() params: VectorSearchManyParamsDto) {
    const results = await this.searchService.search(
      params,
      'vector',
      params.books,
    );

    return results;
  }
}
