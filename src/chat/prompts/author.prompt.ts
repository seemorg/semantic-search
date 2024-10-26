import { Injectable } from '@nestjs/common';
import { langfuse } from '../../shared/langfuse/singleton';
import { UsulBookDetailsResponse } from '../../types/usul';
import { createAzureOpenAI } from '../../shared/azure-openai';
import { ChatMessage } from 'llamaindex';

@Injectable()
export class AuthorChatService {
  private llm = createAzureOpenAI({
    temperature: 0.5,
    enableTracing: true,
    tracingName: 'Chat.OpenAI.NonRAG.Author',
  });

  private getPrompt() {
    return langfuse.getPrompt('non-rag.author');
  }

  async answerQuery({
    bookDetails,
    history,
    query,
  }: {
    bookDetails: UsulBookDetailsResponse;
    history: ChatMessage[];
    query: string;
  }) {
    const prompt = await this.getPrompt();
    const author = bookDetails.book.author;

    const compiledPrompt = prompt.compile({
      primaryName: author.primaryName,
      transliteration: author.transliteration,
      otherNames:
        author.otherNames && author.otherNames.length > 0
          ? author.otherNames.join(', ')
          : '-',
      secondaryName: author.secondaryName ?? '-',
      secondaryOtherNames:
        author.secondaryOtherNames && author.secondaryOtherNames.length > 0
          ? author.secondaryOtherNames.join(', ')
          : '-',
      deathYear:
        author.year && author.year !== -1 ? `${author.year} Hijri` : 'Unknown',
      numberOfBooks: author.numberOfBooks.toString(),
      bio: author.bio ?? '-',
    });

    const response = await this.llm.chat({
      langfusePrompt: prompt,
      stream: true,
      messages: [
        {
          role: 'system',
          content: compiledPrompt,
        },
        ...history,
        { role: 'user', content: query },
      ],
    });

    return response;
  }
}
