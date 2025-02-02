import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { RetrieverModule } from 'src/retriever/retriever.module';
import { UsulModule } from 'src/usul/usul.module';

@Module({
  imports: [RetrieverModule, UsulModule],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
