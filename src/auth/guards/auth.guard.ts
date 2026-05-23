import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import {
  PermisoRequerido,
  REQUIRE_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  DatabaseService,
  ModulePermission,
  RoleSummary,
} from '../../database/database.service';

export interface AuthContext {
  userId: number;
  activeRole: RoleSummary;
  allowedRoles: RoleSummary[];
  permissions: ModulePermission[];
  tokenPayload: any;
}

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

  private readonly authContextRoutes = new Set([
    '/auth/context',
  ]);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly dbService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { auth?: AuthContext; user?: any }>();
    const requestPath = this.normalizeRequestPath(request.originalUrl ?? request.url);
    const moduleRoute = this.getModuleRouteFromRequest(requestPath);
    const normalizedMethod = String(request.method || '').toUpperCase();

    if (normalizedMethod === 'OPTIONS') {
      return true;
    }

    if (!this.allowedHttpMethods.has(normalizedMethod)) {
      throw new ForbiddenException(`Metodo HTTP no permitido: ${normalizedMethod}`);
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

    const requiredPermission = this.reflector.get<PermisoRequerido>(
      REQUIRE_PERMISSIONS_KEY,
      context.getHandler(),
    );

    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Token requerido');
    }

    try {
      const payload = await this.jwtService.verifyAsync<any>(token, {
        secret: process.env.JWT_SECRET,
      });

      if (!payload?.userId) {
        throw new UnauthorizedException('Claims insuficientes en token');
      }

      const authContext = await this.buildAuthContext(payload);
      request.auth = authContext;
      request.user = authContext.tokenPayload?.user ?? { id: authContext.userId };

      if (this.authContextRoutes.has(requestPath)) {
        return true;
      }

      if (!this.canAccess(authContext.permissions, moduleRoute, normalizedMethod)) {
        throw new ForbiddenException(
          `No tienes permiso ${normalizedMethod} sobre ${moduleRoute}`,
        );
      }

      if (
        requiredPermission &&
        !this.hasLegacyPermissionHint(authContext.permissions, requiredPermission)
      ) {
        throw new ForbiddenException(
          `No tienes acceso al modulo ${requiredPermission.modulo}`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Token invalido o expirado');
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

  private canAccess(permissions: ModulePermission[], moduleRoute: string, method: string): boolean {
    const normalizedMethod = method.toUpperCase();

    return permissions.some((modulePermission: ModulePermission) => {
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
    permissions: ModulePermission[],
    permission: PermisoRequerido,
  ): boolean {
    if (!Array.isArray(permissions)) {
      return false;
    }

    return permissions.some(
      (item: ModulePermission) =>
        item?.module === permission.modulo ||
        item?.code === permission.modulo ||
        item?.route === permission.modulo,
    );
  }

  private async buildAuthContext(payload: any): Promise<AuthContext> {
    const userId = Number(payload.userId);
    if (!Number.isFinite(userId)) {
      throw new UnauthorizedException('userId invalido en token');
    }

    const dbUser = await this.dbService.findActiveUserById(userId);
    if (!dbUser || !dbUser.isActive) {
      throw new UnauthorizedException('Usuario no existe o esta inactivo');
    }

    const allowedRoles = await this.dbService.findUserRoles(userId);
    if (allowedRoles.length === 0) {
      throw new ForbiddenException('El usuario no tiene roles asignados');
    }

    const activeRoleIdFromToken = Number(payload.activeRole?.id ?? payload.activeRoleId);
    const activeRole =
      allowedRoles.find((role) => role.id === activeRoleIdFromToken) ?? allowedRoles[0];

    const permissions = await this.dbService.findRolePermissions(activeRole.id);

    return {
      userId,
      activeRole,
      allowedRoles,
      permissions,
      tokenPayload: payload,
    };
  }
}
