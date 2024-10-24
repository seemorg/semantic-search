import { Module } from '@nestjs/common';
import { UsulService } from './usul.service';

@Module({
  providers: [UsulService],
  exports: [UsulService],
})
export class UsulModule {}
