import { Injectable } from '@nestjs/common';
import { createAzureOpenAI } from '../../shared/azure-openai';
import { ChatMessage } from 'llamaindex';
import { langfuse } from 'src/shared/langfuse/singleton';

@Injectable()
export class CondenseService {
  private readonly llm = createAzureOpenAI({
    enableTracing: true,
    tracingName: 'Chat.OpenAI.RAG.Condense',
  });

  private readonly retryLlm = createAzureOpenAI({
    temperature: 0.3,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.RAG.Condense.Retry',
  });

  private getPrompt() {
    return langfuse.getPrompt('rag.condense', undefined, { type: 'chat' });
  }

  async condenseMessageHistory({
    chatHistory,
    query,
    isRetry,
    sessionId,
  }: {
    chatHistory: ChatMessage[];
    query: string;
    isRetry?: boolean;
    sessionId: string;
  }) {
    const llmToUse = isRetry ? this.retryLlm : this.llm;
    const prompt = await this.getPrompt();

    const compiledPrompt = prompt.compile({
      chatHistory: chatHistory
        .map(
          (m) => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`,
        )
        .join('\n'),
      query,
    }) as ChatMessage[];

    const response = await llmToUse.chat({
      langfusePrompt: prompt,
      messages: compiledPrompt,
      sessionId,
    });

    return response.message.content as string;
  }
}
