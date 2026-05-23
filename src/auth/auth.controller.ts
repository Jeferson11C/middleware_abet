import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { AuthContext } from './guards/auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  @ApiBearerAuth()
  @Get('context')
  getContext(@Req() req: Request & { auth?: AuthContext }) {
    if (!req.auth) {
      throw new UnauthorizedException('Contexto de autenticacion no disponible');
    }

    return {
      userId: req.auth.userId,
      activeRole: req.auth.activeRole,
      allowedRoles: req.auth.allowedRoles,
      permissions: req.auth.permissions,
    };
  }
}
