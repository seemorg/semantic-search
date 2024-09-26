import {
  CondenseQuestionChatEngine,
  ChatMessage,
  TextNode,
  Response,
  serviceContextFromDefaults,
} from 'llamaindex';
import { Injectable, MessageEvent } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { Observable } from 'rxjs';
import { FeedbackDto } from './dto/feedback.dto';
import { createVectorStoreIndex } from 'src/shared/vector-store';
import { createAzureOpenAI } from 'src/shared/azure-openai';

@Injectable()
export class ChatService {
  constructor() {}

  private readonly vectorStoreIndex = createVectorStoreIndex();
  private readonly retryServiceContext = serviceContextFromDefaults({
    llm: createAzureOpenAI({
      temperature: 0.3,
    }),
  });

  async chatWithBook(bookSlug: string, body: ChatDto) {
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

    // queryEngine.updatePrompts({
    //   'responseSynthesizer:textQATemplate': ({ context = '', query = '' }) => {
    //     return `Below are snippets of relevant portions of the Sahih text for Al-Bukhari:
    // ---------------------
    // ${context}
    // ---------------------
    // Given the above text and no other prior knowledge, answer the query. Give direct quotes.
    // Query: ${query}
    // Answer:`;
    //   },
    // });

    if (body.messages.length === 0) {
      // If there are no messages, don't use CondenseQuestionChatEngine
      return this.asyncIteratorToObservable(
        await queryEngine.query({
          stream: true,
          query: body.question,
        }),
      );
    }

    const chatHistory = body.messages.map(
      (m): ChatMessage => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }),
    );

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

    const response = await chatEngine.chat({
      message: body.question,
      stream: true,
    });

    return this.asyncIteratorToObservable(response);
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

  private formatChunk(chunk: Response) {
    return {
      ...chunk,
      sourceNodes: chunk.sourceNodes
        ? chunk.sourceNodes.map((n) => ({
            score: n.score,
            text: (n.node as TextNode).text,
            metadata: n.node.metadata,
          }))
        : null,
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
