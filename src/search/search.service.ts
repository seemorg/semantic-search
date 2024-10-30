import { Injectable } from '@nestjs/common';
import { Metadata, NodeWithScore } from 'llamaindex';
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
    const batches = chunk(results, 5);
    const prompt = await langfuse.getPrompt('search.summarize');
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

Results: ${JSON.stringify(batch)}
`.trim(),
            },
          ],
        }),
      ),
    );

    return summaries.flatMap((s, idx) => {
      const nodes = batches[idx];

      const parsed = (
        JSON.parse(s.message.content as string) as {
          summaries: {
            originalIndex: number;
            text: string;
          }[];
        }
      ).summaries;

      return parsed.map((n) => ({
        ...nodes[n.originalIndex],
        summary: n.text,
      }));
    });
  }

  //   private async highlightRelevantText(
  //     query: string,
  //     results: NodeWithScore<Metadata>[],
  //   ) {
  //     const response = await this.llm.chat({
  //       messages: [
  //         {
  //           role: 'system',
  //           content: `
  // Given chunks of text and a user query, return a JSON with words or phrases from the texts that are relevant to the user query so that they can be highlighted.

  // Make sure to:
  // - include keywords as a separate entry in the array
  // - do not include duplicates
  // - do not add html tags and instead add them as they appear exactly

  // Example schema:
  // {
  //   "highlights": [
  //     "..."
  //   ]
  // }
  //         `.trim(),
  //         },
  //         {
  //           role: 'user',
  //           content: `
  // Search Query: ${query}
  // Results:
  // ${JSON.stringify(results.map((r) => (r.node as TextNode).getText()))}

  // Output:
  // `.trim(),
  //         },
  //       ],
  //     });
  //     let highlights:
  //       | {
  //           highlights: string[];
  //         }
  //       | undefined;

  //     try {
  //       highlights = JSON.parse(response.message.content as string) as {
  //         highlights: string[];
  //       };
  //     } catch (e) {}

  //     let updatedResults = results;
  //     if (highlights) {
  //       const regex = new RegExp(
  //         highlights.highlights
  //           .map((highlight) =>
  //             highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'),
  //           )
  //           .join('|'),
  //         'gi',
  //       );

  //       // after we got the results, we need to highlight the relevant parts of the text using gpt-3.5 turbo
  //       updatedResults = results.map((r) => {
  //         const node = r.node as TextNode;
  //         node.text = node.text.replace(regex, (match) => `<em>${match}</em>`);
  //         return r;
  //       });
  //     }

  //     return updatedResults;
  //   }
}
