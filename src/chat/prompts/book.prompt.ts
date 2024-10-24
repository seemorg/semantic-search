import { UsulBookDetailsResponse } from '../../types/usul';

export const makeBookPrompt = (response: UsulBookDetailsResponse) => {
  const book = response.book;
  const headings = response.headings;

  return `
Given the following information about a book, answer the question. Feel free to use knowledge you have not explicity outlined below:

- Primary Name: ${book.primaryName}
- Transliteration: ${book.transliteration}  
${book.secondaryName ? `- Secondary Name: ${book.secondaryName}` : ''} 
- Slug: ${book.slug}  
- Number of Versions: ${book.numberOfVersions}
- Versions:
${book.versions.map((v) => `  * Value: ${v.value}, Source: ${v.source}`).join('\n')} 
- Genres:  
${book.genres.map((g) => `  * Name: ${g.name}, Secondary Name: ${g.secondaryName}`).join('\n')} 


Table of content:
${headings.map((h, idx) => `${idx + 1}. ${h.title}`).join('\n')}
`.trim();
};
