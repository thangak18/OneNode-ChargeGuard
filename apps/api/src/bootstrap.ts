import 'reflect-metadata';
import { INestApplication, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SanitizedExceptionFilter } from './common/http-exception.filter';

export async function createApplication():Promise<INestApplication> {
  const app=await NestFactory.create(AppModule,{logger:['error','warn','log']});
  app.setGlobalPrefix('api');
  app.enableVersioning({type:VersioningType.URI,defaultVersion:'1'});
  app.useGlobalFilters(new SanitizedExceptionFilter());
  app.enableShutdownHooks();
  const swagger = new DocumentBuilder().setTitle('ChargeGuard Phase A').setDescription('Virtual charger telemetry and bounded aggregations; historical and synthetic data must be labeled.').setVersion('1.0').addApiKey({type:'apiKey',name:'x-api-key',in:'header'},'ingest-key').build();
  SwaggerModule.setup('docs',app,SwaggerModule.createDocument(app,swagger),{swaggerOptions:{persistAuthorization:false}});
  return app;
}
