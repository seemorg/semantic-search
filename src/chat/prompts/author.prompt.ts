import { UsulBookDetailsResponse } from '../../types/usul';

export const makeAuthorPrompt = (response: UsulBookDetailsResponse) => {
  const author = response.book.author;

  return `
Given the following information about an Author, answer the question. Feel free to use knowledge you have not explicity outlined below:

- Primary Name: ${author.primaryName}
- Transliteration: ${author.transliteration}
${author.otherNames.length > 0 ? `- Other Names: ${author.otherNames.join(', ')}` : ''}
${author.secondaryName ? `- Secondary Name: ${author.secondaryName}` : ''}
${author.secondaryOtherNames?.length > 0 ? `- Secondary Other Names: ${author.secondaryOtherNames.join(', ')}` : ''}
- Death Year: ${author.year && author.year !== -1 ? `${author.year} Hijri` : 'Unknown'}
- Number of Books: ${author.numberOfBooks}
${author.bio ? `- Bio: ${author.bio}` : ''}
`.trim();
};
