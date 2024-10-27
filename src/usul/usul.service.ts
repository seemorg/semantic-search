import { Injectable } from '@nestjs/common';
import { UsulBookDetailsResponse } from '../types/usul';
import { LRUCache } from 'lru-cache';

const MAX_HEADINGS = 50;

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

    const data = (await response.json()) as UsulBookDetailsResponse;

    if (data.headings.length <= MAX_HEADINGS) {
      return data;
    }

    const currentLevels = [1];
    let newHeadings = [];

    while (newHeadings.length === data.headings.length) {
      const newLevelHeadings = this._getHeadings(data.headings, currentLevels);
      if (newLevelHeadings.length > MAX_HEADINGS) {
        if (currentLevels.length === 1) {
          newHeadings = newLevelHeadings;
        }

        break;
      }

      currentLevels.push(currentLevels[currentLevels.length - 1] + 1);
    }

    data.headings = newHeadings;

    return data;
  }

  private _getHeadings(
    headings: UsulBookDetailsResponse['headings'],
    levels: number[],
  ) {
    const newHeadings = [];

    for (const heading of headings) {
      if (levels.includes(heading.level)) {
        newHeadings.push(heading);
      }
    }

    return newHeadings;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBookDetails(slug: string, _locale: string = 'en') {
    return this.cache.fetch(slug);
  }
}
