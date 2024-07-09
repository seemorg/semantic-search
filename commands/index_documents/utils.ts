export type Book = {
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

export const removeTashkeel = (text: string) => {
  return text.replace(/[ؐ-ًؕ-ٖٓ-ٟۖ-ٰٰۭ]/g, '');
};

const indices = new Map<string, Record<number, number[]>>();
export const createPageToChapterIndex = (slug: string, book: Book) => {
  if (indices.has(slug)) return indices.get(slug)!;

  const index = Object.entries(book.indexes.page_headings).reduce(
    (acc, curr) => {
      const [pageIndex, headingIndices] = curr;
      acc[Number(pageIndex) - 1] = headingIndices.map((i) => i - 1);
      return acc;
    },
    {} as Record<number, number[]>,
  );
  indices.set(slug, index);

  return index;
};

const positions = new Map<
  string,
  { page: number; vol: string; start: number; idx: number; end: number }[]
>();
export const getBookPositions = (slug: string, book: Book) => {
  if (positions.has(slug)) return positions.get(slug)!;

  // Step 3: Create a list of positions for each page's content in the concatenated string
  const value = book.pages.reduce(
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

  positions.set(slug, value);
  return value;
};

export const getChapterTitle = (
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

export const chunk = <T>(arr: T[], size: number) => {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
};
