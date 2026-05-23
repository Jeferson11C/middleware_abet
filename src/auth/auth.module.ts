import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { AuthorizationGuard } from './guards/auth.guard';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    JwtService,
    Reflector,
    AuthorizationGuard,
    {
      provide: APP_GUARD,
      useExisting: AuthorizationGuard,
    },
  ],
})
export class AuthModule {}
