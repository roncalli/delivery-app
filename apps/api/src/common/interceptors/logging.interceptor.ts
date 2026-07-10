import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/** Loga método, rota, status e duração de cada request. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(
            `${request.method} ${request.url} ${response.statusCode} ${Date.now() - start}ms`,
          ),
        error: () =>
          this.logger.warn(`${request.method} ${request.url} ERRO ${Date.now() - start}ms`),
      }),
    );
  }
}
