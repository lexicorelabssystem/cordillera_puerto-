declare module "ioredis" {
  class Redis {
    constructor(url: string, options?: Record<string, unknown>);
    connect(): Promise<void>;
    quit(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<"OK">;
    setex(key: string, seconds: number, value: string): Promise<"OK">;
    del(...keys: string[]): Promise<number>;
    scan(cursor: string, ...args: (string | number)[]): Promise<[string, string[]]>;
    flushdb(): Promise<"OK">;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export default Redis;
}
