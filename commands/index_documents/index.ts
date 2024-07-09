import {
  Document,
  OpenAI,
  OpenAIEmbedding,
  SentenceSplitter,
  Settings,
  VectorStoreIndex,
  SimpleNodeParser,
} from 'llamaindex';
import fs from 'fs';
import path from 'path';
import { stripHtml } from 'string-strip-html';
import { type Book, removeTashkeel, chunk } from './utils';
import { attachMetadataToNodes } from './metadata';
import { createVectorStore } from 'src/shared/vector-store';

const embedModel = new OpenAIEmbedding({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-large',
  embedBatchSize: 30,
});

const chunkSize = 512;

Settings.chunkSize = chunkSize;
Settings.chunkOverlap = 20;

Settings.llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
});
Settings.embedModel = embedModel;

const booksToIndex = [
  { slug: 'sahih', path: '735.json' }, // bukhari
  // { slug: 'muwatta', path: '16050.json' },
  // { slug: 'fath-bari', path: '1673.json' }, // NEXT
  // { slug: 'sunan-3', path: '98138.json' }, // sunan ibn majah
  // { slug: 'ihya-culum-din', path: '9472.json' },
];

const splitter = new SentenceSplitter();

const books = booksToIndex.map((b) => {
  const book = JSON.parse(
    fs.readFileSync(path.resolve('sample_books', b.path), 'utf8'),
  ) as Book;

  const pages = book.pages.map((p) => {
    const pageText = stripHtml(removeTashkeel(p.text)).result;
    return {
      ...p,
      text: splitter.splitText(pageText).join(' '),
    };
  });

  const data = {
    ...book,
    pages,
  };

  return {
    ...b,
    data,
    concatenatedContent: pages.map((p) => p.text).join(' '),
  };
});

const vectorStore = createVectorStore('DEV');

async function main() {
  const docs: Document[] = [];

  for (const book of books) {
    const slug = book.slug;

    docs.push(
      new Document({
        metadata: {
          bookSlug: slug,
        },
        text: book.concatenatedContent,
      }),
    );
  }

  const index = await VectorStoreIndex.fromVectorStore(vectorStore);

  const parser = new SimpleNodeParser();
  console.log('Parsing documents...');

  const nodes = parser.getNodesFromDocuments(docs);
  attachMetadataToNodes(nodes, books);

  // fs.writeFileSync(
  //   'nodes.json',
  //   JSON.stringify(
  //     nodes.map((n) => ({
  //       text: n.text,
  //       metadata: n.metadata,
  //     })),
  //     null,
  //     2,
  //   ),
  // );

  // fs.writeFileSync(
  //   'text.json',
  //   JSON.stringify(
  //     {
  //       texts: books[0].data.pages,
  //     },
  //     null,
  //     2,
  //   ),
  // );

  const batches = chunk(nodes, 30) as (typeof nodes)[];
  let i = 1;
  for (const batch of batches) {
    console.log(`Processing batch ${i} / ${batches.length}...`);
    try {
      await index.insertNodes(batch);
    } catch (e) {
      console.error(e);
      console.log(`Failed to insert batch ${i} / ${batches.length}.`);
    }
    i++;
  }

  console.log('Done!');
}

main();
