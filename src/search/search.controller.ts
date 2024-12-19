import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('/')
  async search(
    @Query('q') query: string,
    @Query('bookSlug') bookSlug: string,
    @Query('type') type: 'semantic' | 'keyword' = 'semantic',
  ) {
    if (!query) {
      throw new BadRequestException('"q" query parameter is required');
    }

    if (type !== 'semantic' && type !== 'keyword') {
      throw new BadRequestException(
        '"type" must be either "semantic" or "keyword"',
      );
    }

    const results = await this.searchService.searchWithinBook(
      bookSlug,
      query,
      type,
    );

    return results;
  }
}
