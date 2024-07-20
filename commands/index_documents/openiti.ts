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
import {
  removeTashkeel,
  chunk,
  getTurathBookById,
  sleep,
  getOpenitiBookById,
} from './utils';
import { attachMetadataToNodes } from './metadata';
import { createVectorStore } from 'src/shared/vector-store';
import booksToIndex from './openiti-books.json';

const indexedBooks = JSON.parse(
  fs.readFileSync(
    path.resolve('commands/index_documents/', 'openiti-indexed-books.json'),
    'utf8',
  ),
) as unknown as Record<string, boolean>;

const chunkSize = 512;

Settings.chunkSize = chunkSize;
Settings.chunkOverlap = 20;

Settings.llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
});
Settings.embedModel = new OpenAIEmbedding({
  azure: {
    apiKey: process.env.AZURE_SECRET_KEY,
    deploymentName: process.env.AZURE_DEPLOYMENT_NAME,
    endpoint: `https://${process.env.AZURE_RESOURCE_NAME}.openai.azure.com/`,
  },
  model: 'text-embedding-3-large',
  embedBatchSize: 30,
});

const splitter = new SentenceSplitter({
  splitLongSentences: true,
});
const parser = new SimpleNodeParser({
  textSplitter: splitter,
});

const vectorStore = createVectorStore('DEV');

const filteredBooks = booksToIndex.filter(({ slug }) => {
  if (indexedBooks[slug] === true || indexedBooks[slug] === false) {
    return false;
  }
  return true;
});
const bookChunks = chunk(filteredBooks, 300) as (typeof booksToIndex)[];

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

const chunkToProcess = bookChunks[chunkIdx];

console.log(`
  PROCESSING CHUNK ${chunkIdx + 1} / ${bookChunks.length}
  `);

let shouldWrite = false;
const markBookIndexStatus = (slug: string, status: boolean = true) => {
  indexedBooks[slug] = status;
  shouldWrite = true;
};

const flush = async () => {
  await writeFile(
    path.resolve(`commands/index_documents/openiti-indexed-books.json`),
    JSON.stringify(indexedBooks, null, 2),
  );
  shouldWrite = false;
};

// setInterval(async () => {
//   if (shouldWrite) {
//     await flush();
//   }
// }, 30 * 1000);

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
    if (bookIdx === 2) {
      break;
    }

    console.log(
      `Processing book ${id} (${bookIdx} / ${chunkToProcess.length})...`,
    );
    const openitiId = versions[0].value;
    if (!openitiId) {
      continue;
    }

    const book = await getOpenitiBookById(id, openitiId);
    const pages = book.pages.map((p) => {
      const pageText = removeTashkeel(
        p.blocks.map((b) => b.content).join('\n'),
      );
      return {
        ...p,
        text: splitter.splitText(pageText).join(' '),
      };
    });
    const data = {
      slug,
      //   data: {
      //     headings: book.indexes.headings,
      //     pageHeadings: book.indexes.page_headings,
      //     pages,
      //   },
      concatenatedContent: pages.map((p) => p.text).join(' '),
    };
    const document = new Document({
      metadata: {
        bookSlug: slug,
      },
      text: data.concatenatedContent,
    });
    const nodes = parser.getNodesFromDocuments([document]);
    fs.writeFileSync(
      path.resolve(`commands/index_documents/${slug}.json`),
      JSON.stringify(nodes, null, 2),
    );
    // fs.writeFileSync(
    //   path.resolve(`commands/index_documents/pages-${slug}.json`),
    //   JSON.stringify(data.data.pages, null, 2),
    // );

    // try {
    //   attachMetadataToNodes(nodes, data);
    // } catch (e) {
    //   console.log(`Failed to attach metadata to book ${slug}.`);
    //   markBookIndexStatus(slug, false);
    //   // fs.writeFileSync(
    //   //   path.resolve(`commands/index_documents/${slug}.json`),
    //   //   JSON.stringify(nodes, null, 2),
    //   // );
    //   // fs.writeFileSync(
    //   //   path.resolve(`commands/index_documents/pages-${slug}.json`),
    //   //   JSON.stringify(data.data.pages, null, 2),
    //   // );
    //   continue;
    // }
    // const batches = chunk(nodes, 80) as (typeof nodes)[];
    // let i = 1;
    // for (const batch of batches) {
    //   console.log(
    //     `[${id} - ${bookIdx} / ${chunkToProcess.length}] Processing batch ${i} / ${batches.length}...`,
    //   );
    //   const chunkBatches = chunk(batch, 10) as (typeof batch)[];
    //   await Promise.all(
    //     chunkBatches.map(async (batch, chunkI) => {
    //       let success = false;
    //       while (!success) {
    //         try {
    //           await index.insertNodes(batch);
    //           success = true;
    //         } catch (e) {
    //           console.error(
    //             `Failed to insert batch (${i} -> ${chunkI}) / ${batches.length}. (${e.message})`,
    //           );
    //           // sleep for 10s
    //           await sleep(10);
    //         }
    //       }
    //     }),
    //   );
    //   i++;
    // }
    // markBookIndexStatus(slug, true);
  }

  await flush();
  console.log('Done!');
}

main();
