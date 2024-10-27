import { UsulBookDetailsResponse } from '../../types/usul';

import { Injectable } from '@nestjs/common';
import { langfuse } from '../../shared/langfuse/singleton';
import { createAzureOpenAI } from '../../shared/azure-openai';
import { ChatMessage } from 'llamaindex';

@Injectable()
export class BookSummaryChatService {
  private llm = createAzureOpenAI({
    temperature: 0.5,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.NonRAG.Book',
  });

  private getPrompt() {
    return langfuse.getPrompt('non-rag.book');
  }

  async answerQuery({
    bookDetails,
    history,
    query,
    traceId,
    sessionId,
  }: {
    bookDetails: UsulBookDetailsResponse;
    history: ChatMessage[];
    query: string;
    traceId: string;
    sessionId: string;
  }) {
    const prompt = await this.getPrompt();
    const book = bookDetails.book;

    const compiledPrompt = prompt.compile({
      primaryName: book.primaryName,
      transliteration: book.transliteration,
      secondaryName: book.secondaryName ?? '-',
      slug: book.slug,
      numberOfVersions: book.numberOfVersions.toString(),
      versions: book.versions
        .map((v) => `  * Value: ${v.value}, Source: ${v.source}`)
        .join('\n'),
      genres: book.genres
        .map((g) => `  * Name: ${g.name}, Secondary Name: ${g.secondaryName}`)
        .join('\n'),
      tableOfContent: bookDetails.headings
        .map((h, idx) => `${idx + 1}. ${h.title}`)
        .join('\n'),
    });

    const response = await this.llm.chat({
      langfusePrompt: prompt,
      traceId,
      sessionId,
      stream: true,
      messages: [
        {
          role: 'system',
          content: compiledPrompt,
        },
        ...history,
        { role: 'user', content: query },
      ],
    });

    return response;
  }
}
