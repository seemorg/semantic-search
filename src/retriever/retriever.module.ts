import { Module } from '@nestjs/common';
import { RetrieverService } from './retriever.service';

@Module({
  providers: [RetrieverService],
  exports: [RetrieverService],
})
export class RetrieverModule {}
