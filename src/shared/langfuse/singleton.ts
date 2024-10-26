import { Langfuse } from 'langfuse';

export const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: 'https://us.cloud.langfuse.com',
});
