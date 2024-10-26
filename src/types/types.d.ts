import type { LangfusePromptClient } from 'langfuse';

declare module 'llamaindex' {
  export interface LLMChatParamsBase {
    langfusePrompt?: LangfusePromptClient;
  }
}

export {};
