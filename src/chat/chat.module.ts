import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { UsulModule } from '../usul/usul.module';
import { CondenseService } from './prompts/condense.prompt';
import { ChatRouterService } from './prompts/router.prompt';
import { ChatFormatterService } from './format.service';
import { AuthorChatService } from './prompts/author.prompt';
import { BookSummaryChatService } from './prompts/book.prompt';
import { RagChatService } from './prompts/rag.prompt';
import { RetrieverModule } from 'src/retriever/retriever.module';

@Module({
  imports: [UsulModule, RetrieverModule],
  providers: [
    CondenseService,
    ChatRouterService,
    ChatFormatterService,
    AuthorChatService,
    BookSummaryChatService,
    RagChatService,
    ChatService,
  ],
  controllers: [ChatController],
})
export class ChatModule {}
