import { Injectable, type MessageEvent } from '@nestjs/common';
import type { ChatResponseChunk, ToolCallLLMMessageOptions } from 'llamaindex';
import { Observable } from 'rxjs';
import type { AzureSearchResult } from 'src/retriever/retriever.service';

@Injectable()
export class ChatFormatterService {
  chatIterableToObservable(
    iterator: AsyncIterable<ChatResponseChunk<ToolCallLLMMessageOptions>>,
    sources?: AzureSearchResult[],
  ) {
    return new Observable<MessageEvent>((subscriber) => {
      (async () => {
        if (sources) {
          subscriber.next({
            data: { type: 'SOURCES', sourceNodes: this.formatSources(sources) },
          });
        }

        for await (const chunk of iterator) {
          subscriber.next({
            data: {
              response: chunk.delta,
            },
          });
        }

        subscriber.next({ data: 'FINISH' });
        subscriber.complete();
      })();
    });
  }

  private formatSources(_sources: AzureSearchResult[]) {
    const sources: {
      score: number;
      text: string;
      metadata: Record<string, any>;
    }[] = [];

    for (const source of _sources) {
      // if (source.node.metadata?.isInternal) {
      //   continue;
      // }

      sources.push({
        score: source.score,
        text: source.node.text,
        metadata: source.node.metadata,
      });
    }

    return sources.length === 0 ? null : sources;
  }
}
