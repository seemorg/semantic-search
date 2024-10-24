import {
  CondenseQuestionChatEngine,
  ChatMessage,
  TextNode,
  Response,
  serviceContextFromDefaults,
  ChatResponseChunk,
  ToolCallLLMMessageOptions,
} from 'llamaindex';
import { Injectable, MessageEvent } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { Observable } from 'rxjs';
import { FeedbackDto } from './dto/feedback.dto';
import { createVectorStoreIndex } from 'src/shared/vector-store';
import { createAzureOpenAI } from 'src/shared/azure-openai';
import { ROUTER_PROMPT } from './prompts/router.prompt';
import { makeAuthorPrompt } from './prompts/author.prompt';
import { makeBookPrompt } from './prompts/book.prompt';
import { UsulService } from '../usul/usul.service';
import { LRUCache } from 'lru-cache';
import { UsulBookDetailsResponse } from 'src/types/usul';

@Injectable()
export class ChatService {
  constructor(private readonly usulService: UsulService) {}

  private readonly vectorStoreIndex = createVectorStoreIndex();
  private readonly routingLlm = createAzureOpenAI({ temperature: 0 });
  private readonly llm = createAzureOpenAI({ temperature: 0.5 });
  private readonly cache = new LRUCache<string, UsulBookDetailsResponse>({
    max: 500,
    fetchMethod: async (key) => {
      const book = await this.usulService.getBookDetails(key);
      if (!book) {
        return;
      }

      return book;
    },
  });

  private readonly retryServiceContext = serviceContextFromDefaults({
    llm: createAzureOpenAI({
      temperature: 0.3,
    }),
  });

  async routeQuery(history: ChatMessage[], query: string) {
    const response = await this.routingLlm.chat({
      additionalChatOptions: {
        response_format: { type: 'json_object' },
      },
      messages: [
        {
          role: 'system',
          content: ROUTER_PROMPT,
        },
        ...history,
        {
          role: 'user',
          content: query,
        },
      ],
    });

    const intent = JSON.parse(response.message.content as string) as {
      intent: 'A' | 'B' | 'C';
    };

    const parsedIntent = ({ A: 'author', B: 'summary', C: 'content' } as const)[
      intent.intent
    ];

    return parsedIntent;
  }

  async answerAuthorQuery({
    bookDetails,
    history,
    query,
  }: {
    bookDetails: UsulBookDetailsResponse;
    history: ChatMessage[];
    query: string;
  }) {
    const response = await this.llm.chat({
      stream: true,
      messages: [
        {
          role: 'system',
          content: makeAuthorPrompt(bookDetails),
        },
        ...history,
        { role: 'user', content: query },
      ],
    });

    return response;
  }

  async answerSummaryQuery({
    bookDetails,
    history,
    query,
  }: {
    bookDetails: UsulBookDetailsResponse;
    history: ChatMessage[];
    query: string;
  }) {
    const response = await this.llm.chat({
      stream: true,
      messages: [
        {
          role: 'system',
          content: makeBookPrompt(bookDetails),
        },
        ...history,
        { role: 'user', content: query },
      ],
    });

    return response;
  }

  async getQueryEngine(bookSlug: string) {
    const index = await this.vectorStoreIndex;

    const queryEngine = index.asQueryEngine({
      similarityTopK: 5,
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

    return queryEngine;
  }

  async chatWithBook(bookSlug: string, body: ChatDto) {
    const chatHistory = body.messages.map(
      (m): ChatMessage => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }),
    );

    let routerResult: 'author' | 'summary' | 'content' | null = null;
    if (bookSlug === 'ihya-culum-din') {
      routerResult = await this.routeQuery(chatHistory, body.question);
    }

    if (routerResult === 'author') {
      const bookDetails = await this.cache.fetch(bookSlug);
      return this.asyncChatResponseChunkToObservable(
        await this.answerAuthorQuery({
          bookDetails,
          history: chatHistory,
          query: body.question,
        }),
      );
    }

    if (routerResult === 'summary') {
      const bookDetails = await this.cache.fetch(bookSlug);
      return this.asyncChatResponseChunkToObservable(
        await this.answerSummaryQuery({
          bookDetails,
          history: chatHistory,
          query: body.question,
        }),
      );
    }

    const queryEngine = await this.getQueryEngine(bookSlug);

    // If there are no messages, don't use CondenseQuestionChatEngine
    if (chatHistory.length === 0) {
      return this.asyncIteratorToObservable(
        await queryEngine.query({
          stream: true,
          query: body.question,
        }),
      );
    }

    const chatEngine = new CondenseQuestionChatEngine({
      queryEngine,
      chatHistory,
      ...(body.isRetry === 'true'
        ? { serviceContext: this.retryServiceContext }
        : {}),
      condenseMessagePrompt({ chatHistory, question }) {
        return `Given a conversation (between Human and Assistant) and a follow up message from Human, rewrite the message to be a standalone question that captures all relevant context from the conversation. The standalone question must be in the same language as the user input.

        <Chat History>
        ${chatHistory}

        <Follow Up Message>
        ${question}

        <Standalone question>
        `;
      },
    });

    return this.asyncIteratorToObservable(
      await chatEngine.chat({
        message: body.question,
        stream: true,
      }),
    );
  }

  private asyncIteratorToObservable(iterator: AsyncIterable<Response>) {
    return new Observable<MessageEvent>((subscriber) => {
      (async () => {
        for await (const chunk of iterator) {
          subscriber.next({ data: this.formatChunk(chunk) });
        }

        subscriber.next({ data: 'FINISH' });
        subscriber.complete();
      })();
    });
  }

  private asyncChatResponseChunkToObservable(
    iterator: AsyncIterable<ChatResponseChunk<ToolCallLLMMessageOptions>>,
  ) {
    return new Observable<MessageEvent>((subscriber) => {
      (async () => {
        for await (const chunk of iterator) {
          subscriber.next({
            data: {
              response: chunk.delta,
              sourceNodes: null,
              metadata: {},
            },
          });
        }

        subscriber.next({ data: 'FINISH' });
        subscriber.complete();
      })();
    });
  }

  private finalResponseToObservable(res: Response) {
    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({ data: this.formatChunk(res) });
      subscriber.next({ data: 'FINISH' });
      subscriber.complete();
    });
  }

  private formatChunk(chunk: Response) {
    const sources: {
      score: number;
      text: string;
      metadata: Record<string, any>;
    }[] = [];
    if (chunk.sourceNodes) {
      for (const source of chunk.sourceNodes) {
        if (source.node.metadata?.isInternal) {
          continue;
        }

        sources.push({
          score: source.score,
          text: (source.node as TextNode).text,
          metadata: source.node.metadata,
        });
      }
    }

    return {
      ...chunk,
      sourceNodes: sources.length === 0 ? null : sources,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async feedback(chatId: string, feedback: FeedbackDto['type']) {
    // const response = await fetch(
    //   `https://api.helicone.ai/v1/${chatId}/feedback`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       // true for positive, false for negative
    //       rating: feedback === 'positive',
    //     }),
    //   },
    // );
    return { success: true };
  }
}
