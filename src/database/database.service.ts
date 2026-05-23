import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  onModuleInit() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
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
}