import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from "@nestjs/common";
import { Observable, throwError, TimeoutError } from "rxjs";
import { timeout, catchError } from "rxjs/operators";

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly defaultTimeout = 30_000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.defaultTimeout),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          const request = context.switchToHttp().getRequest();
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timeout after ${this.defaultTimeout}ms: ${request.method} ${request.url}`,
              ),
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
