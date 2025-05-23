import {
  odata,
  SearchDocumentsResult,
  SearchIterator,
  SearchResult,
  SelectFields,
} from '@azure/search-documents';
import { Injectable } from '@nestjs/common';
import {
  createKeywordSearchClient,
  KeywordSearchBookChunk,
} from './keyword-search.client';
import {
  createVectorSearchClient,
  VectorSearchBookChunk,
} from './vector-search.client';

@Injectable()
export class RetrieverService {
  private readonly keywordSearchClient = createKeywordSearchClient();
  private readonly vectorSearchClient = createVectorSearchClient();

  private async asyncIterableToArray<T extends object>(
    iterable: SearchIterator<T, SelectFields<T>>,
  ) {
    const results: SearchResult<T, SelectFields<T>>[] = [];
    for await (const result of iterable) {
      results.push(result);
    }
    return results;
  }

  async azureGetSourcesFromBook({
    books,
    query,
    type = 'vector',
    limit = 5,
    page = 1,
  }: {
    books?: {
      id: string;
      sourceAndVersion?: string; // source:version
    }[];
    query: string;
    type: 'vector' | 'text';
    limit?: number;
    page?: number;
  }) {
    let filter: string | undefined;
    if (books) {
      if (books.length === 1) {
        const firstBook = books[0]!;
        filter = odata`book_id eq '${firstBook.id}'`;
        if (firstBook.sourceAndVersion) {
          filter += ` and book_version_id eq '${firstBook.sourceAndVersion}'`;
        }
      } else {
        filter = books
          .map(
            (b) =>
              odata`(book_id eq '${b.id}'${
                b.sourceAndVersion
                  ? ` and book_version_id eq '${b.sourceAndVersion}'`
                  : ''
              })`,
          )
          .join(' or ');
      }
    }

    let results: SearchDocumentsResult<
      KeywordSearchBookChunk | VectorSearchBookChunk,
      SelectFields<KeywordSearchBookChunk | VectorSearchBookChunk>
    >;

    if (type === 'text') {
      results = await this.keywordSearchClient.search(query, {
        filter,
        top: limit,
        queryType: 'full',
        searchMode: 'all',
        skip: (page - 1) * limit,
        searchFields: ['content'],
        includeTotalCount: true,
        highlightFields: 'content',
      });
    } else {
      // vector search
      results = await this.vectorSearchClient.search(undefined, {
        filter,
        top: limit,
        skip: (page - 1) * limit,
        includeTotalCount: true,
        vectorSearchOptions: {
          queries: [
            {
              kind: 'text',
              fields: ['chunk_embedding'],
              text: query,
            },
          ],
        },
      });
    }

    const total = results.count;
    const totalPages = Math.ceil(total / limit);

    return {
      total,
      totalPages,
      perPage: limit,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      results: (await this.asyncIterableToArray(results.results)).map((r) => {
        if ('chunk_content' in r.document) {
          return {
            score: r.score,
            node: {
              id: r.document.id,
              text: r.document.chunk_content,
              highlights: r.highlights?.chunk_content ?? [],
              metadata: {
                bookId: r.document.book_id,
                sourceAndVersion: r.document.book_version_id,
                pages: r.document.pages,
                chapters: r.document.chapters,
              },
            },
          };
        }

        return {
          score: r.score,
          node: {
            id: r.document.id,
            text: r.document.content,
            highlights: r.highlights?.content ?? [],
            metadata: {
              bookId: r.document.book_id,
              sourceAndVersion: r.document.book_version_id,
              pages: [
                {
                  index: r.document.index,
                  page: r.document.page,
                  volume: r.document.volume,
                },
              ],
              chapters: r.document.chapters,
            },
          },
        };
      }),
    };
  }
}

export type AzureSearchResponse = Awaited<
  ReturnType<RetrieverService['azureGetSourcesFromBook']>
>;

export type AzureSearchResult = AzureSearchResponse['results'][number];
