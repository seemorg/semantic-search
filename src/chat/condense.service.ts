import { Injectable } from '@nestjs/common';
import { createAzureOpenAI } from '../shared/azure-openai';
import { ChatMessage } from 'llamaindex';
import { makeCondenseMessageHistoryPrompt } from './prompts/condense.prompt';

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

  async condenseMessageHistory({
    chatHistory,
    query,
    isRetry,
  }: {
    chatHistory: ChatMessage[];
    query: string;
    isRetry?: boolean;
  }) {
    const llmToUse = isRetry ? this.retryLlm : this.llm;
    const prompt = makeCondenseMessageHistoryPrompt({ chatHistory, query });

    const response = await llmToUse.chat({
      messages: prompt,
    });

    return response.message.content as string;
  }
}
