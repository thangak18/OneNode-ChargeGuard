import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { APP_CONFIG } from '../config/tokens';

@Global()
@Module({ providers: [{ provide: DatabaseService, useFactory: (config: any) => new DatabaseService(config), inject: [APP_CONFIG] }], exports: [DatabaseService] })
export class DatabaseModule {}
