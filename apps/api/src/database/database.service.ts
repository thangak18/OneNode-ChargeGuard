import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Collection, Db, MongoClient } from 'mongodb';
import { AppConfig } from '../config/config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private client?: MongoClient;
  private connection?: Db;
  constructor(private readonly settings: AppConfig) {}

  async onModuleInit(): Promise<void> {
    this.client = new MongoClient(this.settings.mongoUri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
    try {
      await this.client.connect();
      this.connection = this.client.db(this.settings.mongoDatabase);
      if ((await this.connection.admin().ping()).ok !== 1) throw new Error('Ping failed');
      this.logger.log('MongoDB connected, server ping succeeded');
    } catch {
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
    try { return (await this.db().admin().ping()).ok === 1; } catch { return false; }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.close();
    this.connection = undefined;
  }
}
