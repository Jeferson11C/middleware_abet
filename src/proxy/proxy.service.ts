import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosError } from 'axios';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ProxyService {
  constructor(private readonly httpService: HttpService) {}

  async forwardRequest(
    request: Request,
    path: string,
  ) {
    const translatedPath = this.translateBusinessPath(
      request.method,
      path,
    );
    const backendUrl = `${process.env.BACKEND_NEGOCIO_URL}${translatedPath}`;

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: request.method as any,
          url: backendUrl,
          data: request.body,
          params: request.query,
          headers: {
            ...request.headers,
            host: undefined,
          },
        }),
      );

      return response;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        return {
          status: axiosError.response.status,
          data: axiosError.response.data,
          headers: axiosError.response.headers,
        };
      }

      throw error;
    }
  }

  private translateBusinessPath(method: string, path: string): string {
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = path.replace(/\/+$/, '') || '/';

    // Alias de gateway -> endpoint real de backend para IFCs
    if (normalizedMethod === 'GET' && normalizedPath === '/ifcs') {
      return '/ifcs/get-all';
    }
    if (normalizedMethod === 'POST' && normalizedPath === '/ifcs') {
      return '/ifcs/create';
    }

    return normalizedPath;
  }
}
