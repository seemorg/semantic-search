import {
  // ChromaVectorStore,
  MilvusVectorStore,
  OpenAIEmbedding,
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

export const createVectorStore = (mode: 'DEV' | 'PROD' = 'PROD') => {
  return new MilvusVectorStore({
    collection: process.env.MILVUS_COLLECTION,
    params: {
      configOrAddress: process.env.MILVUS_URL,
    },
    // chromaClientParams: {
    //   path: process.env.CHROMA_PATH,
    // },
    embedModel: new OpenAIEmbedding({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-large',
      additionalSessionOptions: {
        baseURL: 'https://oai.helicone.ai/v1',
        defaultHeaders: {
          'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
          'Helicone-Property-Environment': mode,
        },
      },
    }),
  });
};
