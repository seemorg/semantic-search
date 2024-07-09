import { Module } from '@nestjs/common';
import { AppConfigModule } from './env/env.module';
import { SearchModule } from './search/search.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [AppConfigModule.forRoot(), SearchModule, ChatModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
