import { Injectable } from '@nestjs/common';
import { UsulBookDetailsResponse } from '../types/usul';

@Injectable()
export class UsulService {
  private readonly API_BASE = 'https://api.usul.ai';

  async getBookDetails(slug: string, locale: string = 'en') {
    const response = await fetch(
      `${this.API_BASE}/book/details/${slug}?locale=${locale}`,
    );

    if (response.status > 299) {
      throw new Error(await response.text());
    }

    return (await response.json()) as UsulBookDetailsResponse;
  }
}
