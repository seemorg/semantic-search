import { Injectable } from '@nestjs/common';
import { ChatMessage } from 'llamaindex';
import { createAzureOpenAI } from 'src/shared/azure-openai';
import { langfuse } from '../../shared/langfuse/singleton';

@Injectable()
export class ChatRouterService {
  private readonly llm = createAzureOpenAI({
    temperature: 0,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.Router',
  });

  private getPrompt() {
    return langfuse.getPrompt('router');
  }

  async routeQuery(history: ChatMessage[], query: string) {
    const prompt = await this.getPrompt();
    const compiledPrompt = prompt.compile();

    const response = await this.llm.chat({
      langfusePrompt: prompt,
      additionalChatOptions: {
        response_format: { type: 'json_object' },
      },
      messages: [
        {
          role: 'system',
          content: compiledPrompt,
        },
        ...history,
        {
          role: 'user',
          content: query,
        },
      ],
    });

    if (!response.message?.content) {
      return 'content';
    }

    const intent = JSON.parse(response.message.content as string) as {
      intent: 'A' | 'B' | 'C';
    };

    const parsedIntent = ({ A: 'author', B: 'summary', C: 'content' } as const)[
      intent.intent
    ];

    return parsedIntent;
  }
}
