import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MetricsService } from "./metrics.service.js";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const request = context.switchToHttp().getRequest();
    const startedAt = process.hrtime.bigint();
    return next.handle().pipe(tap({
      next: () => this.record(context, request, startedAt),
      error: (error) => this.record(context, request, startedAt, error?.status ?? error?.statusCode ?? 500),
    }));
  }

  private record(
    context: ExecutionContext,
    request: { method: string; routeOptions?: { url?: string }; routerPath?: string },
    startedAt: bigint,
    errorStatus?: number,
  ) {
    const response = context.switchToHttp().getResponse();
    const route = request.routeOptions?.url ?? request.routerPath ?? "unmatched";
    if (route.endsWith("/metrics")) return;
    this.metrics.recordHttpRequest(
      request.method,
      route,
      errorStatus ?? response.statusCode,
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
    );
  }
}