import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchParamsDto } from './dto/search-params.dto';

@Controller('/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('/')
  async search(@Query() params: SearchParamsDto) {
    const results = await this.searchService.searchWithinBook(params);
    return results;
  }
}
