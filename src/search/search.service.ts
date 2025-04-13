import { BadRequestException, Injectable } from '@nestjs/common';
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

type BookDetails = Awaited<ReturnType<UsulService['getBookDetails']>> & {
  sourceAndVersion: string;
  versionId: string;
};

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
    params: VectorSearchParamsDto,
    books?: {
      id: string;
      versionId: string;
    }[],
  ) {
    const { q: query, limit, page } = params;

    let bookDetails: Record<string, BookDetails> | undefined;
    let booksToSearch:
      | {
          id: string;
          sourceAndVersion: string;
        }[]
      | undefined;
    if (books) {
      const results = await Promise.all(
        books.map(
          async (b) => {
            const data = await this.usulService.getBookDetails(b.id);
            const version = data.book.versions.find(
              (v) => v.id === b.versionId,
            );

            if (!version) {
              throw new BadRequestException(
                `Version "${b.versionId}" is not found for book "${b.id}"`,
              );
            }

            return {
              ...data,
              sourceAndVersion: `${version.source}:${version.value}`,
              versionId: version.id,
            };
          },
          {} as Record<string, BookDetails>,
        ),
      );

      for (const result of results) {
        const searchEntry = {
          id: result.book.id,
          sourceAndVersion: result.sourceAndVersion,
        };

        if (!bookDetails) bookDetails = {};
        if (!booksToSearch) booksToSearch = [];

        bookDetails[`${result.book.id}:${result.sourceAndVersion}`] = result;
        booksToSearch.push(searchEntry);
      }
    }

    const results = await this.retrieverService.azureGetSourcesFromBook({
      books: booksToSearch,
      query,
      type: 'vector',
      limit,
      page,
    });

    return {
      ...results,
      results: results.results.map((r) => {
        const sourceAndVersion = r.node.metadata.sourceAndVersion;
        const details = bookDetails
          ? bookDetails[`${r.node.metadata.bookId}:${sourceAndVersion}`]
          : null;

        return {
          ...r,
          node: {
            ...r.node,
            metadata: {
              ...r.node.metadata,
              versionId: details ? details.versionId : undefined,
              sourceAndVersion: undefined, // don't send it to the client
              version: details
                ? undefined
                : {
                    source: sourceAndVersion.split(':')[0],
                    value: sourceAndVersion.split(':')[1],
                  }, // don't send it to the client
              chapters:
                params.include_chapters && details
                  ? r.node.metadata.chapters.map(
                      (chapterIdx) => details.fullHeadings[chapterIdx],
                    )
                  : undefined,
            },
            highlights: undefined,
          },
        };
      }),
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
      books: [
        {
          id: bookId,
          sourceAndVersion: `${version.source}:${version.value}`,
        },
      ],
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
