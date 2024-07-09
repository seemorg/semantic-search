import { IsEnum, IsString } from 'class-validator';

export class FeedbackDto {
  @IsString()
  @IsEnum(['positive', 'negative'])
  type: 'positive' | 'negative';
}
