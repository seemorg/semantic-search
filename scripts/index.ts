import { Document } from 'langchain/document';
import fs from 'fs';
import path from 'path';
import { Index, Pinecone, RecordMetadata } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { HtmlToTextTransformer } from '@langchain/community/document_transformers/html_to_text';
import { INDEX_NAME } from 'src/shared/constants';
import errorData from './errors.json';

const booksToIndex = [
  { slug: 'muwatta', path: '16050.json' },
  { slug: 'fath-bari', path: '1673.json' },
  { slug: 'sahih', path: '735.json' }, // bukhari
  { slug: 'sunan-3', path: '98138.json' }, // sunan ibn majah
  { slug: 'ihya-culum-din', path: '9472.json' },
];

if (!process.env.PINECONE_API_KEY || !process.env.OPENAI_API_KEY) {
  throw new Error('Please provide PINECONE_API_KEY and OPENAI_API_KEY');
}

const client = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const embeddingClient = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-large',
});

const timeout = 180000;

export const createPineconeIndex = async (
  indexName: string,
  vectorDimension: number,
) => {
  // 1. Initiate index existence check
  console.log(`Checking "${indexName}"...`);

  // 2. Get list of existing indexes
  const existingIndexes = await client.listIndexes();

  const hasIndex = !!existingIndexes?.indexes?.find(
    (i) => i.name === indexName,
  );

  // 3. If index doesn't exist, create it
  if (!hasIndex) {
    // 4. Log index creation initiation
    console.log(`Creating "${indexName}"...`);
    // 5. Create index
    await client.createIndex({
      name: indexName,
      dimension: vectorDimension,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-west-2',
        },
      },
    });
    // 6. Log successful creation
    console.log(
      `Creating index.... please wait for it to finish initializing.`,
    );

    // 7. Wait for index initialization
    await new Promise((resolve) => setTimeout(resolve, timeout));
  } else {
    // 8. Log if index already exists
    console.log(`"${indexName}" already exists.`);
  }
};

const processDocument = async (index: Index<RecordMetadata>, doc: Document) => {
  const { source: txtPath, ...metadata } = doc.metadata;

  const text = doc.pageContent;

  // 4. Create RecursiveCharacterTextSplitter instance
  const textSplitter = RecursiveCharacterTextSplitter.fromLanguage('html', {
    chunkSize: 1000,
  });
  const transformer = new HtmlToTextTransformer();

  // console.log('Splitting text into chunks...');

  // 5. Split text into chunks (documents)
  const chunks = await transformer.transformDocuments(
    await textSplitter.createDocuments([text]),
  );

  // console.log(`Text split into ${chunks.length} chunks`);
  // console.log(
  //   `Calling OpenAI's Embedding endpoint documents with ${chunks.length} text chunks ...`,
  // );

  // 6. Create OpenAI embeddings for documents
  const embeddingsArrays = await embeddingClient.embedDocuments(
    chunks.map((chunk) => chunk.pageContent.replace(/\n/g, ' ')),
  );
  // console.log('Finished embedding documents');
  // console.log(
  //   `Creating ${chunks.length} vectors array with id, values, and metadata...`,
  // );

  // 7. Create and upsert vectors in batches of 100
  const batchSize = 100;
  let batch: any[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]!;
    const vector = {
      id: `${txtPath}_${idx}`,
      values: embeddingsArrays[idx],
      metadata: {
        ...chunk.metadata,
        ...metadata,
        loc: JSON.stringify(chunk.metadata.loc),
        pageContent: chunk.pageContent,
        txtPath,
      },
    };
    batch.push(vector);

    // When batch is full or it's the last item, upsert the vectors
    if (batch.length === batchSize || idx === chunks.length - 1) {
      await index.upsert(batch);
      // Empty the batch
      batch = [];
    }
  }
};

const chunk = (arr: any[], chunkSize: number) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
};

export const updatePinecone = async (indexName: string, docs: Document[]) => {
  console.log('Retrieving Pinecone index...');

  // 1. Retrieve Pinecone index
  const index = client.Index(indexName);

  // 2. Log the retrieved index name
  console.log(`Pinecone index retrieved: ${indexName}`);

  const chunks = chunk(docs, 20) as Document[][];

  const newErrorData = { ...errorData };

  if (errorData.chunks.length > 0) {
    let errorI = 1;
    for (const chunkNumber of errorData.chunks) {
      const chunk = chunks[chunkNumber - 1];
      console.log(
        `Processing errored chunk ${errorI} / ${errorData.chunks.length}...`,
      );

      try {
        await Promise.all(chunk.map((doc) => processDocument(index, doc)));
        // remove the chunk from the errorData
        newErrorData.chunks = newErrorData.chunks.filter(
          (c) => c !== chunkNumber,
        );
      } catch (e) {
        console.error(`[Error] processing chunk: ${chunkNumber}`);
        console.log(e);
      }

      errorI++;
    }
  }

  // const newChunks = chunks.slice(errorData.last - 1);
  // let i = errorData.last;

  // for (const chunk of newChunks) {
  //   console.log(`Processing chunk ${i} / ${chunks.length}...`);

  //   try {
  //     await Promise.all(chunk.map((doc) => processDocument(index, doc)));
  //     errorData.last = i;
  //   } catch (e) {
  //     console.error(`[Error] processing chunk: ${i}`);
  //     newErrorData.chunks.push(i);
  //   }

  //   i++;
  // }

  fs.writeFileSync(
    path.resolve('scripts/errors.json'),
    JSON.stringify(newErrorData, null, 2),
  );
};

type Book = {
  indexes: {
    page_headings: Record<string, number[]>;
    headings: { title: string; page: number; level: number }[];
  };
  pages: {
    text: string;
    page: number;
    vol: string;
  }[];
};

const createPageToChapterIndex = (book: Book) =>
  Object.entries(book.indexes.page_headings).reduce(
    (acc, curr) => {
      const [pageIndex, headingIndices] = curr;
      acc[Number(pageIndex) - 1] = headingIndices.map((i) => i - 1);
      return acc;
    },
    {} as Record<number, number[]>,
  );

const getChapterTitle = (
  book: Book,
  pageIndex: number,
  pageIndexToChapterIndex: ReturnType<typeof createPageToChapterIndex>,
) => {
  // book.indexes.pages_headings is Record<string, number[]> (index of page + 1 -> index of header + 1)
  let chaptersIndex: number[] = [];
  for (const [page, indices] of Object.entries(pageIndexToChapterIndex)) {
    if (Number(page) <= pageIndex) {
      chaptersIndex = indices;
    } else {
      break;
    }
  }

  const titles: string[] = [];
  chaptersIndex.forEach((i) => {
    const h = book.indexes.headings[i];
    if (h) titles.push(h.title);
  });

  return titles;
};

const main = async () => {
  const docs = [];

  for (const entry of booksToIndex) {
    const slug = entry.slug;
    const book = JSON.parse(
      fs.readFileSync(path.resolve('scripts/sample_books', entry.path), 'utf8'),
    ) as Book;

    let i = 0;
    const pageIndexToChapterIndex = createPageToChapterIndex(book);
    for (const page of book.pages) {
      const chapters = getChapterTitle(book, i, pageIndexToChapterIndex);
      i++;

      docs.push(
        new Document({
          metadata: {
            bookSlug: slug,
            source: encodeURIComponent(`${slug}_${page.vol}_${page.page}`),
            chapters: chapters ?? [],
            page: page.page ?? -1,
            vol: page.vol,
          },
          pageContent: page.text,
        }),
      );
    }
  }

  const vectorDimensions = 3072;

  try {
    await createPineconeIndex(INDEX_NAME, vectorDimensions);
    await updatePinecone(INDEX_NAME, docs);
  } catch (err) {
    console.log('error: ', err);
  }

  console.log('Done!');
};

main();
