import { OpenAI, OpenAIEmbedding, Settings } from 'llamaindex';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const setLlamaindexSettings = (_mode: 'DEV' | 'PROD' = 'PROD') => {
  // update llamaindex settings
  Settings.chunkSize = 1024;
  Settings.chunkOverlap = 20;
  Settings.llm = new OpenAI({
    temperature: 0,
    azure: {
      apiKey: process.env.AZURE_SECRET_KEY,
      endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/`,
      apiVersion: '2024-05-13',
      deploymentName: `openai/deployments/${process.env.AZURE_LLM_DEPLOYMENT_NAME}`,
    },
    model: 'gpt-4o',
    // additionalSessionOptions: {
    //   baseURL: 'https://oai.helicone.ai/',
    //   defaultHeaders: {
    //     'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    //     'Helicone-Property-Environment': mode,
    //     'api-key': process.env.AZURE_SECRET_KEY,
    //     'Helicone-OpenAI-Api-Base': `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/`,
    //   },
    // },
  });

  Settings.embedModel = new OpenAIEmbedding({
    azure: {
      apiKey: process.env.AZURE_SECRET_KEY,
      endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/`,
      apiVersion: '1',
      deploymentName: process.env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME,
    },
    model: 'text-embedding-3-large',
    // additionalSessionOptions: {
    //   baseURL: 'https://oai.helicone.ai/v1',
    //   defaultHeaders: {
    //     'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    //     'Helicone-Property-Environment': mode,
    //   },
    // },
  });
};
