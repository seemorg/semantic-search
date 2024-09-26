import { OpenAI, OpenAIEmbedding } from 'llamaindex';

// gpt-4o
export const createAzureOpenAI = ({
  temperature = 0,
  ...config
}: Partial<OpenAI> = {}) =>
  new OpenAI({
    azure: {
      apiKey: process.env.AZURE_SECRET_KEY,
      endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com`,
      deploymentName: process.env.AZURE_LLM_DEPLOYMENT_NAME,
      // apiVersion: '2024-05-13',
    },
    temperature,
    ...config,
  });

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
