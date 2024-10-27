import type { LangfusePromptClient } from 'langfuse';

declare module 'llamaindex' {
  export interface LLMChatParamsBase {
    langfusePrompt?: LangfusePromptClient;
    traceId?: string;
    sessionId?: string;
  }
}

export {};
