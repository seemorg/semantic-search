import fs from 'fs';
import path from 'path';
// import { createVectorStore } from 'src/shared/vector-store';
// import { sleep } from './utils';

const prefix = 'indexed-books-';
const range = [0];
const rangeBooks = range.map((i) => {
  const chunk = JSON.parse(
    fs.readFileSync(path.resolve(`${prefix}${i}.json`), 'utf8'),
  ) as unknown as Record<string, boolean>;

  return chunk;
});

const main = async () => {
  const turathIndexedBooks = JSON.parse(
    fs.readFileSync(
      path.resolve('commands/index_documents/', 'turath-indexed-books.json'),
      'utf8',
    ),
  ) as unknown as Record<string, boolean>;

  const newFile = {};
  // const client = createVectorStore('DEV').client();

  let i = 0;
  // let mismatch = 0;
  const len = Object.keys(turathIndexedBooks).length;

  for (const slug in turathIndexedBooks) {
    console.log(`${++i} / ${len}`);

    // const filter = {
    //   must: [
    //     {
    //       key: 'bookSlug',
    //       match: {
    //         value: slug,
    //       },
    //     },
    //   ],
    // };

    // let points = null;
    // while (points === null) {
    //   try {
    //     const res = await client.scroll(process.env.QDRANT_COLLECTION, {
    //       limit: 1,
    //       filter,
    //     });
    //     points = res.points.length;
    //   } catch (e) {
    //     console.log('Error');
    //     await sleep(10);
    //   }
    // }

    // if (turathIndexedBooks[slug] === true) {
    //   if (points === 0) {
    //     console.log(`Found a mismatch! (${++mismatch})`);
    //     newFile[slug] = false;
    //   } else {
    //     newFile[slug] = true;
    //   }
    // } else {
    //   newFile[slug] = false;
    //   if (points > 0) {
    //     console.log(`Found points! (${++mismatch}), deleting them...`);
    //     let successDelete = false;
    //     while (!successDelete) {
    //       try {
    //         await client.delete(process.env.QDRANT_COLLECTION, {
    //           wait: true,
    //           filter,
    //         });
    //         successDelete = true;
    //       } catch (e) {
    //         console.error('Failed to delete nodes from vector DB.');
    //         await sleep(10);
    //       }
    //     }
    //   }
    // }

    if (turathIndexedBooks[slug] === true) {
      newFile[slug] = true;
    } else {
      if (rangeBooks.findIndex((chunk) => chunk[slug] === true) !== -1) {
        newFile[slug] = true;
      } else {
        newFile[slug] = false;
      }
    }
  }

  fs.writeFileSync(
    path.resolve('commands/index_documents/', 'turath-indexed-books.json'),
    JSON.stringify(newFile, null, 2),
  );

  console.log(
    Object.keys(newFile).filter((slug) => !newFile[slug]).length,
    Object.keys(newFile).length,
  );
};

main();
