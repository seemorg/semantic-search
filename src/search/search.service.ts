import { Injectable } from '@nestjs/common';
import { createAzureOpenAI } from '../shared/azure-openai';
import { langfuse } from '../shared/langfuse/singleton';
import { chunk } from '../shared/utils';
import {
  type AzureSearchResult,
  RetrieverService,
} from 'src/retriever/retriever.service';
import { SearchParamsDto, SearchType } from './dto/search-params.dto';
import { UsulService } from 'src/usul/usul.service';
import { VectorSearchParamsDto } from './dto/vector-search-params.dto';

@Injectable()
export class SearchService {
  constructor(
    private readonly retrieverService: RetrieverService,
    private readonly usulService: UsulService,
  ) {}

  private readonly llm = createAzureOpenAI({
    additionalChatOptions: {
      response_format: { type: 'json_object' },
    },
    enableTracing: true,
    tracingName: 'Search.OpenAI.Book',
  });

  async vectorSearch(
    bookId: string,
    versionId: string,
    params: VectorSearchParamsDto,
  ) {
    const { q: query, limit, page } = params;

    const bookDetails = await this.usulService.getBookDetails(bookId);
    const version = bookDetails.book.versions.find((v) => v.id === versionId);

    if (!version) {
      throw new Error('Version not found');
    }

    const results = await this.retrieverService.azureGetSourcesFromBook({
      id: bookId,
      sourceAndVersion: `${version.source}:${version.value}`,
      query,
      type: 'vector',
      limit,
      page,
    });

    return {
      ...results,
      results: results.results.map((r) => ({
        ...r,
        node: {
          ...r.node,
          metadata: {
            ...r.node.metadata,
            chapters: params.include_chapters
              ? r.node.metadata.chapters.map(
                  (chapterIdx) => bookDetails.fullHeadings[chapterIdx],
                )
              : undefined,
          },
          highlights: undefined,
        },
      })),
    };
  }

  async searchWithinBook(params: SearchParamsDto) {
    const { bookId, versionId, q: query, type } = params;

    const bookDetails = await this.usulService.getBookDetails(bookId);
    const version = bookDetails.book.versions.find((v) => v.id === versionId);

    if (!version) {
      throw new Error('Version not found');
    }

    const results = await this.retrieverService.azureGetSourcesFromBook({
      id: bookId,
      sourceAndVersion: `${version.source}:${version.value}`,
      query,
      type: type === SearchType.SEMANTIC ? 'vector' : 'text',
      limit: params.limit,
      page: params.page,
    });

    if (type === SearchType.KEYWORD) {
      return {
        ...results,
        results: results.results.map((r) => r.node),
      };
    }

    return {
      ...results,
      results: await this.summarizeChunks(query, results.results),
    };
  }

  private async summarizeChunks(query: string, results: AzureSearchResult[]) {
    const formattedResults = results.map((match) => ({
      score: match.score,
      text: match.node.text,
      metadata: match.node.metadata,
    }));

    const batches = chunk(formattedResults, 5) as (typeof formattedResults)[];
    const prompt = await langfuse.getPrompt('search.enhance');
    const compiledPrompt = prompt.compile();

    const summaries = await Promise.all(
      batches.map((batch) =>
        this.llm.chat({
          langfusePrompt: prompt,
          messages: [
            {
              role: 'system',
              content: compiledPrompt,
            },
            {
              role: 'user',
              content: `
Search Query: ${query}

Results: 
${batch.map((r, idx) => `[${idx}]. ${r.text}`).join('\n\n')}
`.trim(),
            },
          ],
        }),
      ),
    );

    return summaries.flatMap((s, idx) => {
      const batch = batches[idx];

      // index -> summary
      let parsed: Record<number, string> = {};

      try {
        parsed = JSON.parse(s.message.content as string);
      } catch (e) {}

      return batch.map((node, idx) => {
        if (!parsed[idx]) {
          return node;
        }

        return {
          ...node,
          text: this.replaceHighlights(parsed[idx]),
        };
      });
    });
  }

  // replace text in [[...]] with <em>...</em>
  // replace text in [..] with <strong>...</strong>
  private replaceHighlights(text: string) {
    return text
      .replace(/\[\[(.*?)\]\]/g, '<em>$1</em>')
      .replace(/\[(.*?)\]/g, '<strong>$1</strong>');
  }
}
