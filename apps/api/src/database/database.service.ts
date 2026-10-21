import { isHostedRuntime } from '../config/runtime';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Collection, Db, MongoClient } from 'mongodb';
import { AppConfig } from '../config/config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private client?: MongoClient;
  private connection?: Db;
  private connecting?: Promise<void>;
  constructor(private readonly settings: AppConfig) {}

  async onModuleInit(): Promise<void> {
    // Hosted services bind before slow network initialization; readiness stays explicit.
    // Authorized requests retry through the readiness middleware.
    if (!isHostedRuntime(process.env)) await this.connect();
  }

  private async connect(): Promise<void> {
    if (this.connection) return;
    if (!this.connecting) this.connecting = this.open().finally(() => { this.connecting = undefined; });
    return this.connecting;
  }

  private async open(): Promise<void> {
    this.client = new MongoClient(this.settings.mongoUri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60000, waitQueueTimeoutMS: 5000 });
    try {
      await this.client.connect();
      const connection = this.client.db(this.settings.mongoDatabase);
      if ((await connection.admin().ping()).ok !== 1) throw new Error('Ping failed');
      this.connection = connection;
      this.logger.log('MongoDB connected, server ping succeeded');
    } catch (error) {
      // Classify fixed error codes only; never emit driver messages or topology hosts.
      const codes = new Set<string>();
      const names = new Set<string>();
      const seen = new Set<object>();
      function inspect(value: unknown, depth = 0): void {
        if (!value || typeof value !== 'object' || seen.has(value) || depth > 5) return;
        seen.add(value);
        const item = value as {code?: unknown; name?: unknown; cause?: unknown; reason?: {servers?: Map<unknown, {error?: unknown}>}};
        if (typeof item.code === 'string' || typeof item.code === 'number') codes.add(String(item.code));
        if (typeof item.name === 'string') names.add(item.name);
        inspect(item.cause, depth + 1);
        if (item.reason?.servers instanceof Map) for (const server of item.reason.servers.values()) inspect(server.error, depth + 1);
      }
      inspect(error);
      const category = codes.has('18') ? 'authentication' : codes.has('13') ? 'authorization' :
        [...codes].some(code => /TLS|SSL|CERT/.test(code)) ? 'tls' :
        [...codes].some(code => ['ENOTFOUND','EAI_AGAIN','EBADRESP'].includes(code)) ? 'dns' :
        [...codes].some(code => ['ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(code)) ? 'tcp' :
        names.has('MongoServerSelectionError') ? 'server_selection' : 'unknown';
      process.stderr.write(JSON.stringify({timestamp:new Date().toISOString(),status:'error',service:'chargeguard-api',message:'database.unavailable',failure_category:category})+'\n');
      await this.client.close().catch(() => {});
      this.connection = undefined;
      this.logger.error('MongoDB connection/ping failed (sensitive details omitted)');
      throw new ServiceUnavailableException('Database unavailable');
    }
  }

  db(): Db {
    if (!this.connection) throw new ServiceUnavailableException('Database unavailable');
    return this.connection;
  }

  collection<T extends import('mongodb').Document = any>(name: string): Collection<T> { return this.db().collection<T>(name); }

  async ping(): Promise<boolean> {
    try {
      if (!this.connection) await this.connect();
      return (await this.db().admin().ping()).ok === 1;
    } catch { return false; }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.close();
    this.connection = undefined;
  }
}
