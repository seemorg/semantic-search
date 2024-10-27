import {
  Body,
  Controller,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { ChatService } from './chat.service';
import { v4 as uuidv4 } from 'uuid';
import { Observable } from 'rxjs';
import { FeedbackDto } from './dto/feedback.dto';

const minutesToMilliseconds = (minutes: number) => minutes * 60 * 1000;

@Controller('/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private readonly chats = new Map<string, Observable<MessageEvent>>();

  @Post('/:bookSlug')
  async initChat(@Body() body: ChatDto, @Param('bookSlug') bookSlug: string) {
    const chatId = uuidv4();
    const chat = await this.chatService.chatWithBook(bookSlug, body, chatId);
    this.chats.set(chatId, chat);

    setTimeout(() => {
      this.chats.delete(chatId);
    }, minutesToMilliseconds(2));

    // return first chunk with chatId
    return { chatId };
  }

  @Sse('/sse/:chatId')
  chat(@Param('chatId') chatId: string): Observable<MessageEvent> {
    const chat = this.chats.get(chatId);
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return chat;
  }

  @Post('/feedback/:chatId')
  async feedback(@Body() body: FeedbackDto, @Param('chatId') chatId: string) {
    try {
      await this.chatService.feedback(chatId, body.type);
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }
}
