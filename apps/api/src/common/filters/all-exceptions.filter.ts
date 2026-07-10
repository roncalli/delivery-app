import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

/**
 * Padroniza TODA resposta de erro da API no formato { statusCode, message, error }.
 * Erros não mapeados (bugs, falhas de infra) viram 500 com mensagem genérica em
 * pt-BR — o detalhe vai para o log, nunca para o cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body: ErrorBody = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor',
      error: 'Internal Server Error',
    };

    if (exception instanceof HttpException) {
      body.statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        body.message = res;
        body.error = exception.name;
      } else {
        const r = res as Partial<ErrorBody>;
        body.message = r.message ?? exception.message;
        body.error = r.error ?? exception.name;
      }
    } else {
      // Erro inesperado: loga stack completo para investigação
      this.logger.error(
        `${request.method} ${request.url} falhou`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }
}
