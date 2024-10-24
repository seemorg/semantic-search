import { OpenAI, OpenAIEmbedding } from 'llamaindex';

// gpt-4o
export const createAzureOpenAI = ({
  temperature = 0,
  enableHelicone,
  ...config
}: Partial<OpenAI> & { enableHelicone?: boolean } = {}) => {
  if (!enableHelicone) {
    return new OpenAI({
      azure: {
        apiKey: process.env.AZURE_SECRET_KEY,
        endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com`,
        deploymentName: process.env.AZURE_LLM_DEPLOYMENT_NAME,
      },
      temperature,
      ...config,
    });
  }

  return new OpenAI({
    additionalSessionOptions: {
      baseURL: `https://oai.helicone.ai/openai/deployments/${process.env.AZURE_LLM_DEPLOYMENT_NAME}`,
      defaultHeaders: {
        'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
        'Helicone-OpenAI-Api-Base': `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com`,
        'api-key': process.env.AZURE_SECRET_KEY,
      },
      defaultQuery: {
        'api-version': '2024-08-01-preview',
      },
    },
    temperature,
    ...config,
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
