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
import { writeFile } from 'fs/promises';
import path from 'path';
import { stripHtml } from 'string-strip-html';
import { removeTashkeel, chunk, getTurathBookById, sleep } from './utils';
import { attachMetadataToNodes } from './metadata';
import { createVectorStore } from 'src/shared/vector-store';
import booksToIndex from './turath-books.json';

const indexedBooks = JSON.parse(
  fs.readFileSync(
    path.resolve('commands/index_documents/', 'turath-indexed-books.json'),
    'utf8',
  ),
) as unknown as Record<string, boolean>;

const embedModel = new OpenAIEmbedding({
  azure: {
    apiKey: process.env.AZURE_SECRET_KEY,
    deploymentName: process.env.AZURE_DEPLOYMENT_NAME,
    endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/`,
  },
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

const splitter = new SentenceSplitter({
  splitLongSentences: true,
});
const parser = new SimpleNodeParser({
  textSplitter: splitter,
});

const vectorStore = createVectorStore('DEV');

const filteredBooks = booksToIndex.filter(({ slug }) => {
  if (indexedBooks[slug] === true) {
    return false;
  }
  return true;
});
const bookChunks = chunk(filteredBooks, 230) as (typeof booksToIndex)[];

let chunkIdx = 0;

// get chunk from args
const chunkArg = process.argv.find((arg) => arg.startsWith('--chunk='));
if (chunkArg) {
  const chunkNum = Number(chunkArg.split('=')[1]);
  if (chunkNum >= 1 && chunkNum <= bookChunks.length) {
    chunkIdx = chunkNum - 1;
  } else {
    console.error(
      `Invalid chunk number. Enter a number from 1 to ${bookChunks.length}.`,
    );
    process.exit(1);
  }
}

const markBookIndexStatus = async (slug: string, status: boolean = true) => {
  indexedBooks[slug] = status;
  await writeFile(
    path.resolve(`commands/index_documents/indexed-books-${chunkIdx}.json`),
    JSON.stringify(indexedBooks, null, 2),
  );
};

const chunkToProcess = bookChunks[chunkIdx];

console.log(`
  PROCESSING CHUNK ${chunkIdx + 1} / ${bookChunks.length}
  `);

async function main() {
  let collectionExists = false;
  try {
    await vectorStore.client().getCollection(process.env.QDRANT_COLLECTION);
    collectionExists = true;
  } catch (e) {}
  if (!collectionExists) {
    console.log('Creating collection...');
    await vectorStore.createCollection(process.env.QDRANT_COLLECTION, 3072);
  }

  const index = await VectorStoreIndex.fromVectorStore(vectorStore);
  let bookIdx = 0;
  for (const { id, slug, versions } of chunkToProcess) {
    bookIdx++;

    console.log(
      `Processing book ${id} (${bookIdx} / ${chunkToProcess.length})...`,
    );
    const turathId = versions.find((v) => v.source === 'turath')?.value;
    if (!turathId) {
      continue;
    }
    const book = await getTurathBookById(turathId);
    const pages = book.pages.map((p) => {
      const pageText = stripHtml(removeTashkeel(p.text)).result;
      const text = splitter.splitText(pageText).join(' ').replaceAll('�', '');

      return {
        ...p,
        text,
      };
    });
    const data = {
      slug,
      data: {
        headings: book.indexes.headings,
        pageHeadings: book.indexes.page_headings,
        pages,
      },
      concatenatedContent: pages.map((p) => p.text).join(' '),
    };
    const document = new Document({
      metadata: {
        bookSlug: slug,
      },
      text: data.concatenatedContent,
    });
    const nodes = parser.getNodesFromDocuments([document]);
    try {
      attachMetadataToNodes(nodes, data);
    } catch (e) {
      console.log(`Failed to attach metadata to book ${slug}.`);
      await markBookIndexStatus(slug, false);
      // fs.writeFileSync(
      //   path.resolve(`commands/index_documents/nodes-${slug}.json`),
      //   JSON.stringify(nodes, null, 2),
      // );
      // fs.writeFileSync(
      //   path.resolve(`commands/index_documents/pages-${slug}.json`),
      //   JSON.stringify(data.data.pages, null, 2),
      // );
      continue;
    }

    // check if some nodes with the same slug are already indexed
    const existingNodes = await vectorStore
      .client()
      .scroll(process.env.QDRANT_COLLECTION, {
        limit: 1,
        filter: {
          must: [
            {
              key: 'bookSlug',
              match: {
                value: slug,
              },
            },
          ],
        },
      });

    if (existingNodes.points.length > 0) {
      console.log(`Book ${slug} already indexed. Deleting previous nodes...`);
      await vectorStore.client().delete(process.env.QDRANT_COLLECTION, {
        wait: true,
        filter: { must: [{ key: 'bookSlug', match: { value: slug } }] },
      });
    }

    const batches = chunk(nodes, 80) as (typeof nodes)[];
    let i = 1;
    for (const batch of batches) {
      console.log(
        `[${id} - ${bookIdx} / ${chunkToProcess.length}] Processing batch ${i} / ${batches.length}...`,
      );
      const chunkBatches = chunk(batch, 10) as (typeof batch)[];
      await Promise.all(
        chunkBatches.map(async (batch, chunkI) => {
          let success = false;
          while (!success) {
            try {
              await index.insertNodes(batch);
              success = true;
            } catch (e) {
              console.error(
                `Failed to insert batch (${i} -> ${chunkI}) / ${batches.length}. (${e.message})`,
              );
              // sleep for 10s
              await sleep(10);
            }
          }
        }),
      );
      i++;
    }
    await markBookIndexStatus(slug, true);
  }

  console.log('Done!');
}

main();
