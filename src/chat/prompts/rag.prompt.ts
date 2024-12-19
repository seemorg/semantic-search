import { UsulBookDetailsResponse } from '../../types/usul';

import { Injectable } from '@nestjs/common';
import { langfuse } from '../../shared/langfuse/singleton';
import { createAzureOpenAI } from '../../shared/azure-openai';
import { ChatMessage } from 'llamaindex';
import type { AzureSearchResult } from 'src/retriever/retriever.service';

@Injectable()
export class RagChatService {
  private readonly llm = createAzureOpenAI({
    temperature: 0.5,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.RAG',
  });

  private readonly retryLlm = createAzureOpenAI({
    temperature: 0.5,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.RAG.Retry',
  });

  private getPrompt() {
    return langfuse.getPrompt('rag');
  }

  private formatSources(sources: AzureSearchResult[]) {
    return sources
      .map((s, idx) => {
        const text = s.node.text;
        return `[${idx + 1}]: ${text}`;
      })
      .join('\n\n');
  }

  async answerQuery({
    bookDetails,
    history,
    query,
    sources,
    isRetry,
    traceId,
    sessionId,
  }: {
    isRetry?: boolean;
    bookDetails: UsulBookDetailsResponse;
    history: ChatMessage[];
    sources: AzureSearchResult[];
    query: string;
    traceId: string;
    sessionId: string;
  }) {
    const prompt = await this.getPrompt();
    const llmToUse = isRetry ? this.retryLlm : this.llm;

    const bookName = bookDetails.book.primaryName;
    const authorName = bookDetails.book.author.primaryName;

    const compiledPrompt = prompt.compile();

    const response = await llmToUse.chat({
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
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `
Most relevant search results in "${bookName}" by "${authorName}":
${this.formatSources(sources)}
          `.trim(),
            },
            {
              type: 'text',
              text: `
User's query:
${query}
          `.trim(),
            },
          ],
        },
      ],
    });

    return response;
  }
}
