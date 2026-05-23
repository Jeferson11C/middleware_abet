import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import {
  PermisoRequerido,
  REQUIRE_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  private readonly allowedHttpMethods = new Set([
    'GET',
    'POST',
    'DELETE',
    'PUT',
    'PATCH',
  ]);

  private readonly publicRoutes = new Set([
    '/login',
    '/auth/login',
    '/auth/logout',
    '/auth/microsoft',
    '/auth/reset-password',
    '/health',
    '/swagger',
    '/docs',
  ]);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const requestPath = this.normalizeRequestPath(request.originalUrl ?? request.url);
    const moduleRoute = this.getModuleRouteFromRequest(requestPath);
    const normalizedMethod = String(request.method || '').toUpperCase();

    if (normalizedMethod === 'OPTIONS') {
      return true;
    }

    if (!this.allowedHttpMethods.has(normalizedMethod)) {
      throw new ForbiddenException(
        `Método HTTP no permitido: ${normalizedMethod}`,
      );
    }

    if (this.isPublicPath(requestPath)) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const permission = this.reflector.get<PermisoRequerido>(
      REQUIRE_PERMISSIONS_KEY,
      context.getHandler(),
    );

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token requerido');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      if (!payload?.userId || !Array.isArray(payload?.permissions)) {
        throw new UnauthorizedException('Claims insuficientes en token');
      }

      if (!this.canAccess(payload, moduleRoute, normalizedMethod)) {
        throw new ForbiddenException(
          `No tienes permiso ${normalizedMethod} sobre ${moduleRoute}`,
        );
      }

      if (permission && !this.hasLegacyPermissionHint(payload, permission)) {
        throw new ForbiddenException(
          `No tienes acceso al módulo ${permission.modulo}`,
        );
      }

      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    if (typeof request.cookies?.access_token === 'string') {
      return request.cookies.access_token;
    }

    const cookieHeader = request.headers?.cookie;
    if (typeof cookieHeader === 'string') {
      const cookieToken = cookieHeader
        .split(';')
        .map((part: string) => part.trim())
        .find((part: string) => part.startsWith('access_token='))
        ?.slice('access_token='.length);

      if (cookieToken) {
        return decodeURIComponent(cookieToken);
      }
    }

    return null;
  }

  private normalizeRequestPath(rawUrl: string): string {
    const pathWithoutQuery = rawUrl.split('?')[0] || '/';
    const cleaned = pathWithoutQuery.replace(/\/+$/, '') || '/';
    return this.stripGatewayPrefixes(cleaned);
  }

  private stripGatewayPrefixes(path: string): string {
    let normalized = path;

    if (normalized.startsWith('/gateway')) {
      normalized = normalized.slice('/gateway'.length) || '/';
    }

    if (normalized.startsWith('/api/v1')) {
      normalized = normalized.slice('/api/v1'.length) || '/';
    }

    return normalized || '/';
  }

  private isPublicPath(path: string): boolean {
    if (this.publicRoutes.has(path)) {
      return true;
    }

    return path === '/docs' || path.startsWith('/docs/');
  }

  private canAccess(decodedToken: any, moduleRoute: string, method: string): boolean {
    const normalizedMethod = method.toUpperCase();

    return decodedToken.permissions.some((modulePermission: any) => {
      if (!modulePermission || typeof modulePermission.route !== 'string') {
        return false;
      }

      const tokenModuleRoute = modulePermission.route.replace(/\/+$/, '') || '/';
      const matchesRoute = tokenModuleRoute === moduleRoute;

      const hasMethodPermission =
        Array.isArray(modulePermission.permissions) &&
        modulePermission.permissions.includes(normalizedMethod);

      return matchesRoute && hasMethodPermission;
    });
  }

  private getModuleRouteFromRequest(path: string): string {
    const firstSegment = path.split('/').filter(Boolean)[0];
    if (!firstSegment) {
      return '/';
    }

    return `/${firstSegment}`;
  }

  private hasLegacyPermissionHint(
    payload: any,
    permission: PermisoRequerido,
  ): boolean {
    if (!Array.isArray(payload?.permissions)) {
      return false;
    }

    return payload.permissions.some(
      (item: any) =>
        item?.module === permission.modulo ||
        item?.code === permission.modulo ||
        item?.route === permission.modulo,
    );
  }
}
