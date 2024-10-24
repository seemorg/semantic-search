import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { UsulModule } from '../usul/usul.module';

@Module({
  imports: [UsulModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
