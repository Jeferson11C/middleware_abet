import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';

import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    HttpModule,
    DatabaseModule,
  ],
  controllers: [ProxyController],
  providers: [ProxyService],
})
export class ProxyModule {}