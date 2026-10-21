import { IngestionMetricsMiddleware } from './observability/ingestion.middleware';
import { JsonFrameworkLogger, ObservabilityService, observabilityConfig } from './observability/observability.service';
import 'reflect-metadata';
import type { Request, Response, NextFunction } from 'express';
import { DatabaseService } from './database/database.service';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { deploymentPolicy } from './common/deployment-policy';
import { INestApplication, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SanitizedExceptionFilter } from './common/http-exception.filter';

export async function createApplication(factory: typeof NestFactory = NestFactory):Promise<INestApplication> {
  const bootstrapObs=new ObservabilityService({...observabilityConfig(process.env),enabled:false});
  const app=await factory.create(AppModule,{logger:new JsonFrameworkLogger(bootstrapObs)});
  return configureApplication(app);
}

export function configureApplication(app:INestApplication):INestApplication {
  // Runs before parsers and controllers, including Swagger and health routes.
  app.use(deploymentPolicy(process.env));
  if (process.env.VERCEL === '1') {
    const database = app.get(DatabaseService);
    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (['/api/v1/health/live','/api/v1/health/atlas-diagnostics'].includes(req.path)) { next(); return; }
      if (!await database.ping()) { res.status(503).json({message: 'Database unavailable'}); return; }
      next();
    });
  }
  const obs=app.get(ObservabilityService);
  app.useLogger(new JsonFrameworkLogger(obs));
  // Register before Nest's JSON parser so malformed JSON failures are observed too.
  const ingestionMetrics=new IngestionMetricsMiddleware(obs);
  app.use(ingestionMetrics.use.bind(ingestionMetrics));
  (app as NestExpressApplication).useBodyParser('json', {limit: process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' ? '8kb' : '100kb'});
  app.setGlobalPrefix('api');
  app.enableVersioning({type:VersioningType.URI,defaultVersion:'1'});
  app.useGlobalFilters(new SanitizedExceptionFilter());
  // The production BFF uses server-to-server HTTP; browser CORS is unnecessary.
  if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1') app.enableCors({origin:true,credentials:true});
  app.enableShutdownHooks();
  const swagger = new DocumentBuilder().setTitle('ChargeGuard Phase A').setDescription('Virtual charger telemetry and bounded aggregations; historical and synthetic data must be labeled.').setVersion('1.0').addApiKey({type:'apiKey',name:'x-api-key',in:'header'},'ingest-key').build();
  SwaggerModule.setup('docs',app,SwaggerModule.createDocument(app,swagger),{swaggerOptions:{persistAuthorization:false}});
  return app;
}
