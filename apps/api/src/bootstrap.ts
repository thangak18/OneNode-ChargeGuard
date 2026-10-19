import { IngestionMetricsMiddleware } from './observability/ingestion.middleware';
import { JsonFrameworkLogger, ObservabilityService, observabilityConfig } from './observability/observability.service';
import 'reflect-metadata';
import { INestApplication, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SanitizedExceptionFilter } from './common/http-exception.filter';

export async function createApplication():Promise<INestApplication> {
  const bootstrapObs=new ObservabilityService({...observabilityConfig(process.env),enabled:false});
  const app=await NestFactory.create(AppModule,{logger:new JsonFrameworkLogger(bootstrapObs)});
  return configureApplication(app);
}

export function configureApplication(app:INestApplication):INestApplication {
  const obs=app.get(ObservabilityService);
  app.useLogger(new JsonFrameworkLogger(obs));
  // Register before Nest's JSON parser so malformed JSON failures are observed too.
  const ingestionMetrics=new IngestionMetricsMiddleware(obs);
  app.use(ingestionMetrics.use.bind(ingestionMetrics));
  app.setGlobalPrefix('api');
  app.enableVersioning({type:VersioningType.URI,defaultVersion:'1'});
  app.useGlobalFilters(new SanitizedExceptionFilter());
  app.enableCors({origin:true,credentials:true});
  app.enableShutdownHooks();
  const swagger = new DocumentBuilder().setTitle('ChargeGuard Phase A').setDescription('Virtual charger telemetry and bounded aggregations; historical and synthetic data must be labeled.').setVersion('1.0').addApiKey({type:'apiKey',name:'x-api-key',in:'header'},'ingest-key').build();
  SwaggerModule.setup('docs',app,SwaggerModule.createDocument(app,swagger),{swaggerOptions:{persistAuthorization:false}});
  return app;
}
