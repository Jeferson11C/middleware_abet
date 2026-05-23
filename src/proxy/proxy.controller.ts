import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { Public } from '../auth/decorators/public.decorator';
import { DatabaseService } from '../database/database.service';
import { ProxyService } from './proxy.service';

@Controller('api/v1')
export class ProxyController {
  constructor(
    private readonly proxyService: ProxyService,
    private readonly dbService: DatabaseService,
  ) {}

  @Public()
  @Get('health')
  async health(@Res() res: Response) {
    const db = await this.dbService.healthCheck();

    return res.json({
      ok: true,
      database: db,
    });
  }

  @ApiParam({
    name: 'path',
    required: true,
    description: 'Ruta de negocio a reenviar (ej: ifcs o ifcs/10)',
    schema: { type: 'string' },
  })
  @Get('*path')
  async forwardGet(
    @Param('path') _path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.forward(req, res);
  }

  @ApiParam({
    name: 'path',
    required: true,
    description: 'Ruta de negocio a reenviar (ej: ifcs o ifcs/10)',
    schema: { type: 'string' },
  })
  @Post('*path')
  async forwardPost(
    @Param('path') _path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.forward(req, res);
  }

  @ApiParam({
    name: 'path',
    required: true,
    description: 'Ruta de negocio a reenviar (ej: ifcs o ifcs/10)',
    schema: { type: 'string' },
  })
  @Put('*path')
  async forwardPut(
    @Param('path') _path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.forward(req, res);
  }

  @ApiParam({
    name: 'path',
    required: true,
    description: 'Ruta de negocio a reenviar (ej: ifcs o ifcs/10)',
    schema: { type: 'string' },
  })
  @Patch('*path')
  async forwardPatch(
    @Param('path') _path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.forward(req, res);
  }

  @ApiParam({
    name: 'path',
    required: true,
    description: 'Ruta de negocio a reenviar (ej: ifcs o ifcs/10)',
    schema: { type: 'string' },
  })
  @Delete('*path')
  async forwardDelete(
    @Param('path') _path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.forward(req, res);
  }

  private async forward(
    req: Request,
    res: Response,
  ) {
    const proxyPath = this.extractProxyPath(req.originalUrl ?? req.url);
    const response = await this.proxyService.forwardRequest(req, proxyPath);
    return res.status(response.status).json(response.data);
  }

  private extractProxyPath(rawUrl: string): string {
    const pathWithoutQuery = rawUrl.split('?')[0] || '/';

    let normalized = pathWithoutQuery;
    if (normalized.startsWith('/gateway')) {
      normalized = normalized.slice('/gateway'.length) || '/';
    }
    if (normalized.startsWith('/api/v1')) {
      normalized = normalized.slice('/api/v1'.length) || '/';
    }

    return normalized || '/';
  }
}
