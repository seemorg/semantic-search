import { Settings } from 'llamaindex';
import { createAzureOpenAI, createAzureOpenAIEmbeddings } from './azure-openai';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const setLlamaindexSettings = (_mode: 'DEV' | 'PROD' = 'PROD') => {
  // update llamaindex settings
  Settings.chunkSize = 1024;
  Settings.chunkOverlap = 20;
  Settings.llm = createAzureOpenAI();

  Settings.embedModel = createAzureOpenAIEmbeddings();
};
