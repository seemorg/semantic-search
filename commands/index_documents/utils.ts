import { Block, parseMarkdown } from '@openiti/markdown-parser';
import { TurathBookResponse } from 'src/types/turath';
import slugify from 'slugify';

export const removeTashkeel = (text: string) => {
  return text.replace(/[ؐ-ًؕ-ٖٓ-ٟۖ-ٰٰۭ]/g, '');
};

export const createPageToChapterIndex = (
  pageHeadings: TurathBookResponse['indexes']['page_headings'],
) => {
  const index = Object.entries(pageHeadings).reduce(
    (acc, curr) => {
      const [pageIndex, headingIndices] = curr;
      acc[Number(pageIndex) - 1] = headingIndices.map((i) => i - 1);
      return acc;
    },
    {} as Record<number, number[]>,
  );

  return index;
};

export const getBookPositions = (pages: TurathBookResponse['pages']) => {
  // Step 3: Create a list of positions for each page's content in the concatenated string
  const value = pages.reduce(
    (acc, item, idx) => {
      const start = acc.length > 0 ? acc[acc.length - 1].end + 1 : 0; // Add 2 for the space delimiter
      const end = start + item.text.length;
      acc.push({ page: item.page, vol: item.vol, start, end, idx });
      return acc;
    },
    [] as {
      page: number;
      vol: string;
      start: number;
      idx: number;
      end: number;
    }[],
  );

  return value;
};

export const getChapterTitle = (
  headings: TurathBookResponse['indexes']['headings'],
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
    const h = headings[i];
    if (h) titles.push(h.title);
  });

  return titles;
};

export const chunk = <T>(arr: T[], size: number) => {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
};

const bookKeysMap = `
meta id name type printed pdf_links info info_long version \
author_id cat_id date_built author_page_start indexes volumes \
headings print_pg_to_pg volume_bounds page_map page_headings non_author
`
  .trim()
  .split(' ');

const unObfuscateKeys = (s: string) =>
  s.replace(
    /"([ً-ٟ])":/g,
    (m, m1) => `"${bookKeysMap[m1.charCodeAt(0) - 0x064b]}":`,
  );

export const getTurathBookById = async (id: number | string) => {
  const text = await (
    await fetch(`https://files.turath.io/books-v3/${id}.json`)
  ).text();
  return JSON.parse(unObfuscateKeys(text)) as TurathBookResponse;
};

export const getOpenitiBookById = async (id: string, versionId: string) => {
  const [authorId] = id.split('.');
  const baseUrl = `https://raw.githubusercontent.com/OpenITI/RELEASE/2385733573ab800b5aea09bc846b1d864f475476/data/${authorId}/${id}/${versionId}`;
  let response = await fetch(baseUrl);

  if (!response.ok || response.status >= 300) {
    response = await fetch(`${baseUrl}.completed`);

    if (!response.ok || response.status >= 300) {
      response = await fetch(`${baseUrl}.mARkdown`);

      if (!response.ok || response.status >= 300) {
        throw new Error('Book not found');
      }
    }
  }

  const text = await response.text();

  const final = parseMarkdown(text);

  const chapterSlugs = new Set<string>();
  // an array of headings (1-3) to be used as a table of contents
  const chapters: {
    id: string; // a unique id for the header so we can link to it
    content: string;
    level?: number;
    page: { volume: string | number; page: string | number } | null;
  }[] = [];

  // final is an array that contains the content of the book in the following format:
  // [text, text, pageNumber, text, text, pageNumber, ...]
  // we need to split the content into pages by the pageNumber blocks
  const pages: {
    page: { volume: string | number; page: string | number } | null;
    blocks: Block[];
  }[] = [];
  let currentPage: Block[] = [];
  let currentHeaders: typeof chapters = [];

  for (let i = 0; i < final.content.length; i++) {
    const block = final.content[i]!;

    if (block.type === 'pageNumber') {
      const stringVolume = block.content.volume;
      const stringPage = block.content.page;

      const numberVolume = Number(stringVolume);
      const numberPage = Number(stringPage);

      const volume = isNaN(numberVolume) ? stringVolume : numberVolume;
      const page = isNaN(numberPage) ? stringPage : numberPage;

      pages.push({
        page: {
          volume,
          page,
        },
        blocks: [...currentPage],
      });
      chapters.push(
        ...currentHeaders.map((h) => ({ ...h, page: { volume, page } })),
      );

      currentPage = [];
      currentHeaders = [];
    } else {
      currentPage.push(block);

      if (
        (block.type === 'header' && block.level >= 1 && block.level <= 3) ||
        block.type === 'title'
      ) {
        const id = generateHeaderId(block.content, chapterSlugs);
        chapterSlugs.add(id);
        currentHeaders.push({
          id,
          content: block.content,
          level: 'level' in block ? block.level : undefined,
          page: null,
        });
      }
    }
  }

  // add the last page
  if (currentPage.length > 0) {
    pages.push({ page: null, blocks: [...currentPage] });
  }

  if (currentHeaders.length > 0) {
    chapters.push(...currentHeaders);
  }

  return { pages, chapters };
};

function generateHeaderId(content: string, prevSlugs: Set<string>) {
  const id = slugify(content, { lower: true });

  if (!prevSlugs.has(id)) {
    return id;
  }

  let i = 1;
  while (prevSlugs.has(`${id}-${i}`)) {
    i++;
  }

  return `${id}-${i}`;
}

export const sleep = (s: number) =>
  new Promise((resolve) => setTimeout(resolve, s * 1000));
