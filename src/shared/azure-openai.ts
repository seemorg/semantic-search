import { OpenAI, OpenAIEmbedding } from 'llamaindex';

export const createAzureOpenAI = ({
  temperature = 0,
  ...config
}: Partial<OpenAI> = {}) =>
  new OpenAI({
    apiKey: '',
    azure: {
      apiKey: process.env.AZURE_SECRET_KEY,
      endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com`,
      deploymentName: process.env.AZURE_LLM_DEPLOYMENT_NAME,
      // apiVersion: '2024-05-13',
    },
    model: 'gpt-4o',
    temperature,
    ...config,
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

export const createAzureOpenAIEmbeddings = (
  config: Partial<OpenAIEmbedding> = {},
) =>
  new OpenAIEmbedding({
    apiKey: '',
    azure: {
      apiKey: process.env.AZURE_SECRET_KEY,
      endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com`,
      deploymentName: process.env.AZURE_EMBEDDINGS_DEPLOYMENT_NAME,
      // apiVersion: '1',
    },
    model: 'text-embedding-3-large',
    ...config,
    // additionalSessionOptions: {
    //   baseURL: 'https://oai.helicone.ai/v1',
    //   defaultHeaders: {
    //     'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    //     'Helicone-Property-Environment': mode,
    //   },
    // },
  });
