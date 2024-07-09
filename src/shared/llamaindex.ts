import { OpenAI, OpenAIEmbedding, Settings } from 'llamaindex';

export const setLlamaindexSettings = (mode: 'DEV' | 'PROD' = 'PROD') => {
  // update llamaindex settings
  Settings.chunkSize = 1024;
  Settings.chunkOverlap = 20;
  Settings.llm = new OpenAI({
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o',
    additionalSessionOptions: {
      baseURL: 'https://oai.helicone.ai/v1',
      defaultHeaders: {
        'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
        'Helicone-Property-Environment': mode,
      },
    },
  });

  Settings.embedModel = new OpenAIEmbedding({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-large',
    additionalSessionOptions: {
      baseURL: 'https://oai.helicone.ai/v1',
      defaultHeaders: {
        'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
        'Helicone-Property-Environment': mode,
      },
    },
  });
};
