import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ProxyModule } from './proxy/proxy.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),

    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
    }),

    DatabaseModule,
    AuthModule,
    ProxyModule,
  ],
})
export class AppModule {}