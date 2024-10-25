import { Injectable } from '@nestjs/common';
import { ChatMessage } from 'llamaindex';
import { createAzureOpenAI } from 'src/shared/azure-openai';
import { ROUTER_PROMPT } from './prompts/router.prompt';

@Injectable()
export class ChatRouterService {
  private readonly llm = createAzureOpenAI({
    temperature: 0,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.Router',
  });

  async routeQuery(history: ChatMessage[], query: string) {
    const response = await this.llm.chat({
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
