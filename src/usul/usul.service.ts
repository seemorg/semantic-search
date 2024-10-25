import { Injectable } from '@nestjs/common';
import { UsulBookDetailsResponse } from '../types/usul';
import { LRUCache } from 'lru-cache';

@Injectable()
export class UsulService {
  private readonly API_BASE = 'https://api.usul.ai';

  private readonly cache = new LRUCache<string, UsulBookDetailsResponse>({
    max: 500,
    fetchMethod: async (key) => {
      const book = await this._getBookDetails(key);
      if (!book) {
        return;
      }

      return book;
    },
  });

  private async _getBookDetails(slug: string, locale: string = 'en') {
    const response = await fetch(
      `${this.API_BASE}/book/details/${slug}?locale=${locale}`,
    );

    if (response.status > 299) {
      throw new Error(await response.text());
    }

    return (await response.json()) as UsulBookDetailsResponse;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBookDetails(slug: string, _locale: string = 'en') {
    return this.cache.fetch(slug);
  }
}
