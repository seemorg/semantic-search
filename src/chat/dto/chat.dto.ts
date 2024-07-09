import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBooleanString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ChatDto {
  @IsString()
  question: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  @ArrayMinSize(0)
  messages: MessageDto[];

  @IsBooleanString()
  @IsOptional()
  isRetry?: 'true' | 'false';
}

class MessageDto {
  @IsEnum(['user', 'ai'])
  role: 'user' | 'ai';

  @IsString()
  text: string;
}
