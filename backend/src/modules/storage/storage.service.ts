import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Client } from "minio";
import * as fs from "node:fs";
import * as path from "node:path";

interface StorageConfig {
  storage: {
    driver: "local" | "minio";
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    documentsBucket: string;
    tempBucket: string;
    archivesBucket: string;
  };
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client | null;

  constructor(@Inject("APP_CONFIG") private readonly config: StorageConfig) {
    const storage = config.storage;
    this.client = storage.driver === "minio"
      ? new Client({ endPoint: storage.endpoint, port: storage.port, useSSL: storage.useSSL, accessKey: storage.accessKey, secretKey: storage.secretKey })
      : null;
  }

  async onModuleInit() {
    if (!this.client) return;
    for (const bucket of [this.config.storage.documentsBucket, this.config.storage.tempBucket, this.config.storage.archivesBucket]) {
      if (!(await this.client.bucketExists(bucket))) await this.client.makeBucket(bucket);
    }
    this.logger.log("MinIO storage backend enabled");
  }

  get isMinio() { return this.client !== null; }
  get documentsBucket() { return this.config.storage.documentsBucket; }
  get tempBucket() { return this.config.storage.tempBucket; }
  get archivesBucket() { return this.config.storage.archivesBucket; }

  async put(bucket: string, key: string, data: Buffer, mimeType: string) {
    if (this.client) {
      await this.client.putObject(bucket, key, data, data.length, { "Content-Type": mimeType });
      return this.uri(bucket, key);
    }
    const filePath = path.resolve("uploads", key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data);
    return filePath;
  }

  async get(storagePath: string) {
    const parsed = this.parseUri(storagePath);
    if (parsed && this.client) return this.client.getObject(parsed.bucket, parsed.key);
    return fs.createReadStream(storagePath);
  }

  async getBuffer(storagePath: string): Promise<Buffer> {
    const stream = await this.get(storagePath);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async remove(storagePath: string) {
    const parsed = this.parseUri(storagePath);
    if (parsed && this.client) {
      await this.client.removeObject(parsed.bucket, parsed.key);
      return;
    }
    await fs.promises.rm(storagePath, { force: true });
  }

  async exists(storagePath: string) {
    const parsed = this.parseUri(storagePath);
    if (parsed && this.client) {
      try { await this.client.statObject(parsed.bucket, parsed.key); return true; } catch { return false; }
    }
    return fs.existsSync(storagePath);
  }

  uri(bucket: string, key: string) { return `minio://${bucket}/${key}`; }

  private parseUri(value: string) {
    if (!value.startsWith("minio://")) return null;
    const rest = value.slice("minio://".length);
    const slash = rest.indexOf("/");
    return slash > 0 ? { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) } : null;
  }
}