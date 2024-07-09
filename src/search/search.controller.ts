import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { TextNode } from 'llamaindex';
// import { PineconeService } from 'src/pinecone/pinecone.service';

@Controller('/search')
export class SearchController {
  // constructor(private readonly pineconeService: PineconeService) {}
  constructor(private readonly searchService: SearchService) {}

  @Get('/')
  async search(
    @Query('q') query: string,
    @Query('bookSlug') bookSlug?: string,
  ) {
    if (!query) {
      throw new BadRequestException('"q" query parameter is required');
    }

    // const results = await this.pineconeService.query(query, bookSlug);
    const results = await this.searchService.searchWithinBook(bookSlug, query);

    return results.map((match) => ({
      score: match.score,
      text: (match.node as TextNode).text,
      metadata: match.node.metadata,
    }));
  }
}
