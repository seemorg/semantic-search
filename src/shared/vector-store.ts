import { QdrantClient } from '@qdrant/js-client-rest';
import {
  QdrantVectorStore,
  serviceContextFromDefaults,
  VectorStoreIndex,
} from 'llamaindex';
import { createAzureOpenAI, createAzureOpenAIEmbeddings } from './azure-openai';

let vectorStore: QdrantVectorStore | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createVectorStore = (_mode: 'DEV' | 'PROD' = 'PROD') => {
  if (vectorStore) {
    return vectorStore;
  }

  const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    port: 443,
    https: true,
  });

  vectorStore = new QdrantVectorStore({
    collectionName: process.env.QDRANT_COLLECTION,
    client: client,
  });

  return vectorStore;
};

let vectorStoreIndex: Promise<VectorStoreIndex> | null = null;
export const createVectorStoreIndex = async (mode: 'DEV' | 'PROD' = 'PROD') => {
  if (vectorStoreIndex) {
    return vectorStoreIndex;
  }

  vectorStoreIndex = VectorStoreIndex.fromVectorStore(
    createVectorStore(mode),
    serviceContextFromDefaults({
      embedModel: createAzureOpenAIEmbeddings(),
      llm: createAzureOpenAI({
        enableTracing: true,
        tracingName: 'Chat.OpenAI.RAG',
      }),
    }),
  );

  return vectorStoreIndex;
};
