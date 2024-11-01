import { Injectable } from '@nestjs/common';
import { Metadata, NodeWithScore, TextNode } from 'llamaindex';
import { createAzureOpenAI } from '../shared/azure-openai';
import { langfuse } from '../shared/langfuse/singleton';
import { createVectorStoreIndex } from '../shared/vector-store';
import { chunk } from '../shared/utils';

@Injectable()
export class SearchService {
  private readonly vectorStoreIndex = createVectorStoreIndex();

  private readonly llm = createAzureOpenAI({
    additionalChatOptions: {
      response_format: { type: 'json_object' },
    },
    enableTracing: true,
    tracingName: 'Search.OpenAI.Book',
  });

  async searchWithinBook(bookSlug: string, query: string) {
    const index = await this.vectorStoreIndex;

    const queryEngine = index.asRetriever({
      similarityTopK: 10,
    });

    const results = await queryEngine.retrieve({
      query,
      preFilters: {
        filters: [
          {
            key: 'bookSlug',
            value: bookSlug,
            filterType: 'ExactMatch',
          },
        ],
      },
    });

    const updatedResults = await this.summarizeChunks(query, results);

    return updatedResults;
  }

  private async summarizeChunks(
    query: string,
    results: NodeWithScore<Metadata>[],
  ) {
    const formattedResults = results.map((match) => ({
      score: match.score,
      text: (match.node as TextNode).text,
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
