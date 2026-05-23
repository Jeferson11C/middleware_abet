import { SetMetadata } from '@nestjs/common';

export interface PermisoRequerido {
  modulo: string;
  permiso: string;
}

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';

export const RequirePermissions = (
  config: PermisoRequerido,
) => SetMetadata(REQUIRE_PERMISSIONS_KEY, config);