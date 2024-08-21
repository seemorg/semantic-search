import { QdrantClient } from '@qdrant/js-client-rest';
import {
  // ChromaVectorStore,
  QdrantVectorStore,
  // OpenAIEmbedding,
} from 'llamaindex';

// export const createVectorStore = (mode: 'DEV' | 'PROD' = 'PROD') => {
//   return new ChromaVectorStore({
//     collectionName: process.env.CHROMA_COLLECTION,
//     chromaClientParams: {
//       path: process.env.CHROMA_PATH,
//     },
//     embedModel: new OpenAIEmbedding({
//       apiKey: process.env.OPENAI_API_KEY,
//       model: 'text-embedding-3-large',
//       additionalSessionOptions: {
//         baseURL: 'https://oai.helicone.ai/v1',
//         defaultHeaders: {
//           'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
//           'Helicone-Property-Environment': mode,
//         },
//       },
//     }),
//   });
// };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const createVectorStore = (_mode: 'DEV' | 'PROD' = 'PROD') => {
  const client = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    port: 443,
    https: true,
  });

  return new QdrantVectorStore({
    collectionName: process.env.QDRANT_COLLECTION,
    client: client,
    // embedModel: new OpenAIEmbedding({
    //   apiKey: process.env.OPENAI_API_KEY,
    //   model: 'text-embedding-3-large',
    //   additionalSessionOptions: {
    //     baseURL: 'https://oai.helicone.ai/v1',
    //     defaultHeaders: {
    //       'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    //       'Helicone-Property-Environment': mode,
    //     },
    //   },
    // }),
  });
};
