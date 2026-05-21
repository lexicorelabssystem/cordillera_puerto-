import { Injectable, Logger, Optional, Inject } from "@nestjs/common";

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<"OK">;
  setex(key: string, seconds: number, value: string): Promise<"OK">;
  del(...keys: string[]): Promise<number>;
  scan(cursor: string, ...args: (string | number)[]): Promise<[string, string[]]>;
  flushdb(): Promise<"OK">;
}

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number | null;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly memoryStore = new Map<string, CacheEntry>();
  readonly redisClient: RedisClient | null;

  constructor(@Optional() @Inject("REDIS_CLIENT") redisClient: RedisClient | null) {
    this.redisClient = redisClient ?? null;
    if (this.redisClient) {
      this.logger.log("Redis cache backend enabled");
    } else {
      this.logger.log("REDIS_URL not set — falling back to in-memory cache");
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redisClient) {
      const raw = await this.redisClient.get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    }

    const entry = this.memoryStore.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);

    if (this.redisClient) {
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await this.redisClient.setex(key, ttlSeconds, serialized);
      } else {
        await this.redisClient.set(key, serialized);
      }
      return;
    }

    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.memoryStore.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.del(key);
      return;
    }
    this.memoryStore.delete(key);
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (this.redisClient) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.redisClient.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } while (cursor !== "0");
      return;
    }

    const regex = this.globToRegex(pattern);
    for (const key of this.memoryStore.keys()) {
      if (regex.test(key)) {
        this.memoryStore.delete(key);
      }
    }
  }

  async flush(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.flushdb();
      return;
    }
    this.memoryStore.clear();
  }

  private globToRegex(pattern: string): RegExp {
    let regexStr = "";
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      switch (ch) {
        case "*":
          regexStr += ".*";
          break;
        case "?":
          regexStr += ".";
          break;
        case ".":
        case "+":
        case "^":
        case "$":
        case "(":
        case ")":
        case "[":
        case "]":
        case "{":
        case "}":
        case "|":
        case "\\":
          regexStr += "\\" + ch;
          break;
        default:
          regexStr += ch;
      }
    }
    return new RegExp(`^${regexStr}$`);
  }
}
