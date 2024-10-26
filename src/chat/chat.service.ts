import type { ChatMessage } from 'llamaindex';
import { Injectable } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { createVectorStoreIndex } from 'src/shared/vector-store';
import { AuthorChatService } from './prompts/author.prompt';
import { BookSummaryChatService } from './prompts/book.prompt';
import { UsulService } from '../usul/usul.service';
import { CondenseService } from './prompts/condense.prompt';
import { RagChatService } from './prompts/rag.prompt';
import { ChatRouterService } from './prompts/router.prompt';
import { ChatFormatterService } from './format.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly usulService: UsulService,
    private readonly condenseService: CondenseService,
    private readonly routerService: ChatRouterService,
    private readonly formatterService: ChatFormatterService,
    private readonly authorService: AuthorChatService,
    private readonly bookService: BookSummaryChatService,
    private readonly ragService: RagChatService,
  ) {}

  private readonly vectorStoreIndex = createVectorStoreIndex();

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
        await this.authorService.answerQuery({
          bookDetails,
          history: chatHistory,
          query: body.question,
        }),
      );
    }

    if (routerResult === 'summary') {
      return this.formatterService.chatIterableToObservable(
        await this.bookService.answerQuery({
          bookDetails,
          history: chatHistory,
          query: body.question,
        }),
      );
    }

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
      await this.ragService.answerQuery({
        bookDetails,
        history: chatHistory,
        query: ragQuery,
        sources,
        isRetry: body.isRetry === 'true',
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
