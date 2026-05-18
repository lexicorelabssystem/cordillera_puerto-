import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const elapsed = Date.now() - now;
          this.logger.log(`${method} ${url} → ${response.statusCode} (${elapsed}ms)`);
        },
        error: (error) => {
          const elapsed = Date.now() - now;
          const status = error?.status ?? error?.statusCode ?? 500;
          this.logger.warn(`${method} ${url} → ${status} (${elapsed}ms)`);
        },
      }),
    );
  }
}
