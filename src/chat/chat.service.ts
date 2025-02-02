import type { ChatMessage } from 'llamaindex';
import { Injectable } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { AuthorChatService } from './prompts/author.prompt';
import { BookSummaryChatService } from './prompts/book.prompt';
import { UsulService } from '../usul/usul.service';
import { CondenseService } from './prompts/condense.prompt';
import { RagChatService } from './prompts/rag.prompt';
import { ChatRouterService } from './prompts/router.prompt';
import { ChatFormatterService } from './format.service';
import { langfuse } from 'src/shared/langfuse/singleton';
import { v4 as uuidv4 } from 'uuid';
import { RetrieverService } from 'src/retriever/retriever.service';

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
    private readonly retrieverService: RetrieverService,
  ) {}

  async chatWithBook(
    bookId: string,
    versionId: string,
    body: ChatDto,
    chatId: string,
  ) {
    const sessionId = uuidv4();

    // get last 6 messages
    const chatHistory = body.messages.slice(-6).map(
      (m): ChatMessage => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }),
    );

    const routerResult = await this.routerService.routeQuery(
      chatHistory,
      body.question,
      sessionId,
    );
    const bookDetails = await this.usulService.getBookDetails(bookId);

    if (routerResult === 'author') {
      return this.formatterService.chatIterableToObservable(
        await this.authorService.answerQuery({
          bookDetails,
          history: chatHistory,
          query: body.question,
          traceId: chatId,
          sessionId,
        }),
      );
    }

    if (routerResult === 'summary') {
      return this.formatterService.chatIterableToObservable(
        await this.bookService.answerQuery({
          bookDetails,
          history: chatHistory,
          query: body.question,
          traceId: chatId,
          sessionId,
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
        sessionId,
      });
    }

    const version = bookDetails.book.versions.find((v) => v.id === versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const sources = await this.retrieverService
      .azureGetSourcesFromBook({
        id: bookDetails.book.id,
        sourceAndVersion: `${version.source}:${version.value}`,
        query: ragQuery,
        type: 'vector',
      })
      .then((r) => r.results);

    return this.formatterService.chatIterableToObservable(
      await this.ragService.answerQuery({
        bookDetails,
        history: chatHistory,
        query: ragQuery,
        sources,
        isRetry: body.isRetry === 'true',
        traceId: chatId,
        sessionId,
      }),
      sources,
    );
  }

  async feedback(chatId: string, feedback: FeedbackDto['type']) {
    langfuse.score({
      traceId: chatId,
      name: 'user_feedback',
      value: feedback === 'negative' ? 0 : 1,
    });

    return { success: true };
  }
}
