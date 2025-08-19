import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class SecurityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SecurityLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || 'Unknown';
    const startTime = Date.now();

    // 민감한 API 엔드포인트 로깅
    if (url.includes('/login/codes') && method !== 'GET' || url.includes('/login/code/')) {
      this.logger.log(`[${method}] ${url} - IP: ${ip} - UserAgent: ${userAgent}`);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          if (url.includes('/login/')) {
            this.logger.log(`[${method}] ${url} - ${response.statusCode} - ${duration}ms - IP: ${ip}`);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(`[${method}] ${url} - ERROR: ${error.message} - ${duration}ms - IP: ${ip}`);
        }
      })
    );
  }
}