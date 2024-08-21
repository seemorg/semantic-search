import { Injectable } from '@nestjs/common';
import { OpenAI, TextNode, VectorStoreIndex } from 'llamaindex';
import { createVectorStore } from 'src/shared/vector-store';

@Injectable()
export class SearchService {
  private readonly vectorStore = createVectorStore();
  private readonly llm = new OpenAI({
    apiKey: '',
    azure: {
      apiKey: process.env.AZURE_SECRET_KEY,
      endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com`,
      // apiVersion: '2024-05-13',
      deploymentName: process.env.AZURE_LLM_DEPLOYMENT_NAME,
    },
    model: 'gpt-4o',
    temperature: 0,
    maxTokens: 1000,
    // additionalSessionOptions: {
    //   baseURL: 'https://oai.helicone.ai/v1',
    //   defaultHeaders: {
    //     'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    //   },
    // },
    additionalChatOptions: {
      response_format: { type: 'json_object' },
    },
  });

  async searchWithinBook(bookSlug: string, query: string) {
    const index = await VectorStoreIndex.fromVectorStore(this.vectorStore);
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

    // const example = {
    //   highlights: [
    //     'Some text that is relevant to the user query',
    //     'Another piece of text that is relevant to the user query',
    //   ],
    // };

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: `
Given chunks of text and a user query, return a JSON with words or phrases from the texts that are relevant to the user query so that they can be highlighted. 

Make sure to:
- include keywords as a separate entry in the array
- do not include duplicates
- do not add html tags and instead add them as they appear exactly

Example schema:
{
  "highlights": [
    "..."
  ]
}
        `.trim(),
        },
        {
          role: 'user',
          content: `
Search Query: ${query}
Results: 
${JSON.stringify(results.map((r) => (r.node as TextNode).getText()))}

Output: 
`.trim(),
        },
      ],
    });
    let highlights:
      | {
          highlights: string[];
        }
      | undefined;

    try {
      highlights = JSON.parse(response.message.content as string) as {
        highlights: string[];
      };
    } catch (e) {}

    let updatedResults = results;
    if (highlights) {
      const regex = new RegExp(
        highlights.highlights
          .map((highlight) =>
            highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'),
          )
          .join('|'),
        'gi',
      );

      // after we got the results, we need to highlight the relevant parts of the text using gpt-3.5 turbo
      updatedResults = results.map((r) => {
        const node = r.node as TextNode;
        node.text = node.text.replace(regex, (match) => `<em>${match}</em>`);
        return r;
      });
    }

    return updatedResults;
  }
}
