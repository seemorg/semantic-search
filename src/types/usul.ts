interface BookVersion {
  id: string;
  source: 'openiti' | 'turath' | 'external' | 'pdf';
  value: string;
  aiSupported?: boolean;
  keywordSupported?: boolean;
  publicationDetails?: {
    investigator?: string;
    publisher?: string;
    editionNumber?: string;
    publicationYear?: number; // hijri
  };
}

interface BookFlags {
  aiSupported?: boolean;
  aiVersion?: string;
}

type PublicationDetails = {
  title?: string;
  author?: string;
  editor?: string;
  publisher?: string;
  printVersion?: string;
  volumes?: string;
  pageNumbersMatchPrint?: boolean;
};

export type UsulBookDetailsResponse = {
  book: {
    id: string;
    slug: string;
    author: {
      id: string;
      slug: string;
      transliteration: string;
      year?: number | null;
      numberOfBooks: number;
      primaryName: string;
      otherNames: string[];
      secondaryName?: string | null;
      secondaryOtherNames?: string[] | null;
      bio: string;
    };
    transliteration: string;
    versions: BookVersion[];
    numberOfVersions: number;
    flags: BookFlags;
    primaryName: string;
    otherNames: string[];
    secondaryName?: string | null;
    secondaryOtherNames?: string[] | null;
    genres: {
      id: string;
      slug: string;
      transliteration: string;
      numberOfBooks: number;
      name: string;
      secondaryName: string;
    }[];
  };
  headings: (
    | { volume?: number; page?: number; title: string; level: number }
    | { page?: { vol: string; page: number }; title: string; level: number }
  )[];
  fullHeadings: (
    | { volume?: number; page?: number; title: string; level: number }
    | { page?: { vol: string; page: number }; title: string; level: number }
  )[];
  publicationDetails?: PublicationDetails;
};
