import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap, shareReplay } from "rxjs/operators";

interface CacheEntry {
  response: unknown;
  timestamp: number;
  hits: number;
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultTtl: number;
  private readonly maxEntries: number;

  constructor(ttlMs = 30_000, maxEntries = 200) {
    this.defaultTtl = ttlMs;
    this.maxEntries = maxEntries;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    if (request.method !== "GET") {
      return next.handle();
    }

    const key = `${request.method}:${request.url}`;
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.defaultTtl) {
      cached.hits++;
      return of(cached.response);
    }

    if (cached) {
      this.cache.delete(key);
    }

    return next.handle().pipe(
      tap((response) => {
        this.evictIfFull();
        this.cache.set(key, { response, timestamp: Date.now(), hits: 0 });
      }),
      shareReplay(1),
    );
  }

  private evictIfFull(): void {
    if (this.cache.size < this.maxEntries) return;
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [k, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug(`LRU evicted: ${oldestKey}`);
    }
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }

  get size(): number {
    return this.cache.size;
  }
}
