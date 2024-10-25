import { OpenAI, OpenAIEmbedding } from 'llamaindex';
import { observeOpenAI } from './langfuse/openai';

// gpt-4o
export const createAzureOpenAI = ({
  temperature = 0,
  enableTracing,
  tracingName,
  ...config
}: Partial<OpenAI> & {
  enableTracing?: boolean;
  tracingName?: string;
} = {}) => {
  const client = new OpenAI({
    azure: {
      apiKey: process.env.AZURE_SECRET_KEY,
      endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com`,
      deploymentName: process.env.AZURE_LLM_DEPLOYMENT_NAME,
    },
    temperature,
    ...config,
  });

  if (!enableTracing) {
    return client;
  }

  return observeOpenAI(client, {
    generationName: tracingName,
    clientInitParams: {
      secretKey: process.env.LANGFUSE_SECRET_KEY,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY,
      baseUrl: 'https://us.cloud.langfuse.com',
    },
  });
};

// text-embedding-3-large
export const createAzureOpenAIEmbeddings = (
  config: Partial<OpenAIEmbedding> = {},
) =>
  new OpenAIEmbedding({
    azure: {
      apiKey: process.env.AZURE_SECRET_KEY,
      endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com`,
      deploymentName: process.env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME,
    },
    dimensions: 3072,
    ...config,
  });
