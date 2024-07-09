import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const error = exception.getResponse() as string | Record<string, string>;

    return response.status(status).json({
      status: status,
      error:
        typeof error === 'string'
          ? error
          : error?.error || error?.message || error,
      message: (error as any)?.message,
    });
  }
}
