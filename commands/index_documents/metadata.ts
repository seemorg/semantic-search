import { TextNode } from 'llamaindex';
import {
  Book,
  createPageToChapterIndex,
  getBookPositions,
  getChapterTitle,
  removeTashkeel,
} from './utils';

export const attachMetadataToNodes = (
  nodes: TextNode[],
  books: {
    slug: string;
    data: Book;
    concatenatedContent: string;
  }[],
) => {
  // pre-process node
  // 1. set chapter & page number in metadata
  // 2. remove tashkeel
  let i = 0;
  for (const node of nodes) {
    i++;
    const bookSlug = node.metadata?.bookSlug as string;
    if (!bookSlug) continue;

    const book = books.find((b) => b.slug === bookSlug);
    if (!book) continue;

    const pageIndexToChapterIndex = createPageToChapterIndex(
      bookSlug,
      book.data,
    );

    const matchedPageIndices = new Set<number>();

    const chunkStart = book.concatenatedContent.indexOf(node.text);
    const chunkEnd = chunkStart + node.text.length;

    if (chunkStart === -1) {
      console.log(`[NODE ${i}] Could not link metadata!`);
      continue;
    }

    getBookPositions(bookSlug, book.data)
      .filter((pos) => pos.start <= chunkEnd && pos.end >= chunkStart)
      .forEach((p) => {
        matchedPageIndices.add(p.idx);
      });

    let startIndex = 0;

    // Iterate over each page's content to find overlaps
    book.data.pages.forEach((page, idx) => {
      const pageContent = page.text;
      let index = pageContent.indexOf(node.text, startIndex);

      // Check if the chunk overlaps with the current page content
      while (index !== -1) {
        matchedPageIndices.add(idx);
        startIndex = index + node.text.length;
        index = pageContent.indexOf(node.text, startIndex);
      }
    });

    const matchedIndicesArray = Array.from(matchedPageIndices);
    const pageNumbers = [
      ...new Set(
        matchedIndicesArray
          .map((idx) => ({
            page: book.data.pages[idx].page,
            vol: book.data.pages[idx].vol,
          }))
          .map((p) => `v${p.vol}:p${p.page}`),
      ),
    ];
    const chapterTitles = [
      ...new Set(
        matchedIndicesArray.flatMap((idx) =>
          getChapterTitle(book.data, idx, pageIndexToChapterIndex),
        ),
      ),
    ];

    node.metadata.chapters = JSON.stringify(chapterTitles.map(removeTashkeel));
    node.metadata.pages = JSON.stringify(pageNumbers);

    node.setContent(node.text);
  }
};
