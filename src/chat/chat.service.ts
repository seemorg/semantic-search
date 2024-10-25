import type { ChatMessage } from 'llamaindex';
import { Injectable } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { createVectorStoreIndex } from 'src/shared/vector-store';
import { createAzureOpenAI } from 'src/shared/azure-openai';
import { makeAuthorPrompt } from './prompts/author.prompt';
import { makeBookPrompt } from './prompts/book.prompt';
import { UsulService } from '../usul/usul.service';
import { UsulBookDetailsResponse } from 'src/types/usul';
import { CondenseService } from './condense.service';
import { makeRagMessages } from './prompts/rag.prompt';
import { ChatRouterService } from './router.service';
import { ChatFormatterService } from './format.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly usulService: UsulService,
    private readonly condenseService: CondenseService,
    private readonly routerService: ChatRouterService,
    private readonly formatterService: ChatFormatterService,
  ) {}

  private readonly vectorStoreIndex = createVectorStoreIndex();

  private readonly authorLlm = createAzureOpenAI({
    temperature: 0.5,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.NonRAG.Author',
  });

  private readonly bookLlm = createAzureOpenAI({
    temperature: 0.5,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.NonRAG.Book',
  });

  private readonly ragLlm = createAzureOpenAI({
    temperature: 0.5,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.RAG',
  });

  private readonly retryRagLlm = createAzureOpenAI({
    temperature: 0.5,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.RAG.Retry',
  });

  async answerAuthorQuery({
    bookDetails,
    history,
    query,
  }: {
    bookDetails: UsulBookDetailsResponse;
    history: ChatMessage[];
    query: string;
  }) {
    const response = await this.authorLlm.chat({
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
    const response = await this.bookLlm.chat({
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

  async retrieveSources(bookSlug: string, query: string) {
    const index = await this.vectorStoreIndex;

    const retriever = index.asRetriever({
      similarityTopK: 5,
    });

    return retriever.retrieve({
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
  }

  async chatWithBook(bookSlug: string, body: ChatDto) {
    const chatHistory = body.messages.map(
      (m): ChatMessage => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }),
    );

    const routerResult = await this.routerService.routeQuery(
      chatHistory,
      body.question,
    );
    const bookDetails = await this.usulService.getBookDetails(bookSlug);

    if (routerResult === 'author') {
      return this.formatterService.chatIterableToObservable(
        await this.answerAuthorQuery({
          bookDetails,
          history: chatHistory,
          query: body.question,
        }),
      );
    }

    if (routerResult === 'summary') {
      return this.formatterService.chatIterableToObservable(
        await this.answerSummaryQuery({
          bookDetails,
          history: chatHistory,
          query: body.question,
        }),
      );
    }

    const llmToUse = body.isRetry === 'true' ? this.retryRagLlm : this.ragLlm;

    let ragQuery: string;
    // If there are no messages, don't condense the history
    if (chatHistory.length === 0) {
      ragQuery = body.question;
    } else {
      ragQuery = await this.condenseService.condenseMessageHistory({
        chatHistory,
        query: body.question,
        isRetry: body.isRetry === 'true',
      });
    }

    const sources = await this.retrieveSources(bookSlug, ragQuery);

    return this.formatterService.chatIterableToObservable(
      await llmToUse.chat({
        stream: true,
        messages: makeRagMessages({
          response: bookDetails,
          history: chatHistory,
          query: body.question,
          sources,
        }),
      }),
      sources,
    );
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
