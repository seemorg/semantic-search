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
    const results = await this.searchService.vectorSearch(params, [
      {
        id: bookId,
        versionId,
      },
    ]);

    return results;
  }

  @Get('/v1/vector-search')
  @UseApiKey()
  async vectorSearchMany(@Query() params: VectorSearchManyParamsDto) {
    let books:
      | {
          id: string;
          versionId: string;
        }[]
      | undefined;
    if (params.books) {
      books = params.books.split(',').map((pair) => {
        const [bookId, versionId] = pair.split(':');
        return {
          id: bookId,
          versionId,
        };
      });
    }

    const results = await this.searchService.vectorSearch(params, books);

    return results;
  }
}
