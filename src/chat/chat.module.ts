import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { UsulModule } from '../usul/usul.module';
import { CondenseService } from './condense.service';
import { ChatRouterService } from './router.service';
import { ChatFormatterService } from './format.service';

@Module({
  imports: [UsulModule],
  providers: [
    CondenseService,
    ChatRouterService,
    ChatFormatterService,
    ChatService,
  ],
  controllers: [ChatController],
})
export class ChatModule {}
