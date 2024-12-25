import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { RetrieverModule } from 'src/retriever/retriever.module';

@Module({
  imports: [RetrieverModule],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
