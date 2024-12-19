import { AzureKeyCredential, SearchClient } from '@azure/search-documents';

export type KeywordSearchBookChunk = {
  id: string;
  book_id: string;
  book_version_id: string;
  content: string;
  chapters: number[]; // chapter indices
  index: number; // page index
  page: number;
  volume?: string | null;
};

export const createKeywordSearchClient = () =>
  new SearchClient<KeywordSearchBookChunk>(
    process.env.AZURE_SEARCH_ENDPOINT,
    process.env.AZURE_KEYWORD_SEARCH_INDEX,
    new AzureKeyCredential(process.env.AZURE_SEARCH_KEY),
  );
