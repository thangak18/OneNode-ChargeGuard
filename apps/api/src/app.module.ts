import { ObservabilityModule } from './observability/observability.module';
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { TelemetryController } from './telemetry/telemetry.controller';
import { TelemetryService } from './telemetry/telemetry.service';
import { IngestGuard } from './telemetry/ingest.guard';
import { AnalyticsService } from './analytics/analytics.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { ChargersService } from './chargers/chargers.service';
import { ChargersController, StationsController } from './chargers/chargers.controller';
import { IncidentsService } from './incidents/incidents.service';
import { IncidentsController } from './incidents/incidents.controller';
import { DemoService } from './demo/demo.service';
import { DemoController } from './demo/demo.controller';

@Module({
  imports:[AppConfigModule,ObservabilityModule,DatabaseModule],
  providers:[
    TelemetryService,AnalyticsService,IngestGuard,
    ChargersService,IncidentsService,DemoService
  ],
  controllers:[
    HealthController,TelemetryController,AnalyticsController,
    ChargersController,StationsController,IncidentsController,DemoController
  ]
})
export class AppModule {}
