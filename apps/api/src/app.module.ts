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

@Module({
  imports:[AppConfigModule,ObservabilityModule,DatabaseModule],
  providers:[
    TelemetryService,AnalyticsService,IngestGuard
  ],
  controllers:[HealthController,TelemetryController,AnalyticsController]
})
export class AppModule {}
