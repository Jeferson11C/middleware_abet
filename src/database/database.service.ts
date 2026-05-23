import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

export interface RoleSummary {
  id: number;
  name: {
    en: string;
    es: string;
  };
}

export interface ModulePermission {
  id: number;
  code: string;
  module: string;
  route: string;
  permissions: string[];
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  onModuleInit() {
    const hasDiscreteConfig =
      !!process.env.DB_HOST &&
      !!process.env.DB_PORT &&
      !!process.env.DB_USER &&
      !!process.env.DB_NAME;

    const sslEnabled = String(process.env.DB_SSL || '').toLowerCase() === 'true';

    this.pool = new Pool({
      ...(hasDiscreteConfig
        ? {
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
          }
        : {
            connectionString: process.env.DATABASE_URL,
          }),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.logger.log('Database pool initialized');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async verificarPermiso(
    userId: number,
    activeRole: string,
    moduloId: string,
    permisoType: string,
  ): Promise<boolean> {
    const query = `
      SELECT 1
      FROM "Rol_Modulo" rm
      INNER JOIN "Rol_Usuar" ru
        ON rm."rol_id" = ru."rol_id"
      INNER JOIN "Rol" r
        ON r."id" = ru."rol_id"
      WHERE ru."usuario_id" = $1
        AND r."code" = $2
        AND rm."modulo_typ_id" = $3
        AND rm."permiso_type" = $4
      LIMIT 1;
    `;

    const result = await this.pool.query(query, [
      userId,
      activeRole,
      moduloId,
      permisoType,
    ]);

    return result.rowCount > 0;
  }

  async healthCheck() {
    const result = await this.pool.query('SELECT NOW()');
    return result.rows[0];
  }

  async findActiveUserById(userId: number): Promise<{ id: number; isActive: boolean } | null> {
    const query = `
      SELECT
        u.id,
        u.is_active AS "isActive"
      FROM organization.users u
      WHERE u.id = $1
      LIMIT 1;
    `;

    const result = await this.pool.query(query, [userId]);
    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0];
  }

  async findUserRoles(userId: number): Promise<RoleSummary[]> {
    const query = `
      SELECT DISTINCT
        r.id,
        r.name
      FROM core.user_roles ur
      INNER JOIN core.roles r
        ON r.id = ur.role_id
      WHERE ur.user_id = $1
        AND ur.is_active = TRUE
        AND r.is_active = TRUE
      ORDER BY r.id ASC;
    `;

    const result = await this.pool.query(query, [userId]);

    return result.rows.map((row) => ({
      id: Number(row.id),
      name: {
        en: String(row.name?.en ?? ''),
        es: String(row.name?.es ?? ''),
      },
    }));
  }

  async findRolePermissions(roleId: number): Promise<ModulePermission[]> {
    const query = `
      SELECT
        MIN(rmp.id) AS id,
        mt.code AS code,
        COALESCE(mt.extra->>'module', mt.name->>'en', '') AS module,
        COALESCE(mt.extra->>'route', '') AS route,
        COALESCE(array_agg(DISTINCT (pt.name->>'en')) FILTER (WHERE pt.name->>'en' IS NOT NULL), ARRAY[]::text[]) AS permissions
      FROM core.role_module_permissions rmp
      INNER JOIN core.types mt
        ON mt.id = rmp.module_type_id
      INNER JOIN core.types pt
        ON pt.id = rmp.permission_type_id
      WHERE rmp.role_id = $1
        AND rmp.is_active = TRUE
      GROUP BY mt.id, mt.code, mt.extra, mt.name
      ORDER BY MIN(rmp.id) ASC;
    `;

    const result = await this.pool.query(query, [roleId]);

    return result.rows.map((row) => ({
      id: Number(row.id),
      code: String(row.code ?? ''),
      module: String(row.module ?? ''),
      route: String(row.route ?? ''),
      permissions: Array.isArray(row.permissions)
        ? row.permissions.map((permission: string) => String(permission).toUpperCase())
        : [],
    }));
  }
}
