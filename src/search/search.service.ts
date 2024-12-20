import { Injectable } from '@nestjs/common';
import { createAzureOpenAI } from '../shared/azure-openai';
import { langfuse } from '../shared/langfuse/singleton';
import { chunk } from '../shared/utils';
import {
  type AzureSearchResult,
  RetrieverService,
} from 'src/retriever/retriever.service';
import { UsulService } from 'src/usul/usul.service';

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

  async searchWithinBook(
    bookId: string,
    query: string,
    type: 'semantic' | 'keyword' = 'semantic',
  ) {
    const results = await this.retrieverService
      .azureGetSourcesFromBook(
        bookId,
        query,
        type === 'semantic' ? 'vector' : 'text',
        10,
      )
      .then((r) => r.results);

    if (type === 'keyword') {
      return results.map((match) => match.node);
    }

    return this.summarizeChunks(query, results);
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
