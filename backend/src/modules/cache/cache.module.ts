import { Global, Module, Logger, OnModuleDestroy } from "@nestjs/common";
import { CacheService } from "./cache.service.js";

@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CLIENT",
      useFactory: async (appConfig: { redisUrl?: string }) => {
        const redisUrl = appConfig?.redisUrl;
        if (!redisUrl) {
          return null;
        }
        try {
          const { default: Redis } = await import("ioredis");
          const client = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times: number) {
              if (times > 3) return null;
              return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
          });
          await client.connect();
          return client;
        } catch (err) {
          const logger = new Logger("RedisFactory");
          logger.warn(
            `Failed to connect to Redis at ${redisUrl}; falling back to in-memory cache`,
          );
          logger.debug((err as Error).message);
          return null;
        }
      },
      inject: ["APP_CONFIG"],
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule implements OnModuleDestroy {
  constructor(private readonly cacheService: CacheService) {}

  async onModuleDestroy() {
    if (this.cacheService.redisClient) {
      const client = this.cacheService.redisClient as { quit?: () => Promise<void> };
      if (client.quit) {
        await client.quit();
      }
    }
  }
}
