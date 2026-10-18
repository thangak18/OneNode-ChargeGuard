import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';
import { IngestGuard } from './ingest.guard';
import { AnalyticsService } from '../analytics/analytics.service';

const example = {eventId:'sample-001',ts:'2026-10-18T08:00:00Z',meta:{stationId:'demo-station-01',chargerId:'demo-charger-01'},currentA:12.3,chargingState:'CHARGING',provenance:{sourceType:'SYNTHETIC',fields:{currentA:'SYNTHETIC',chargingState:'SYNTHETIC'}}};
@ApiTags('Telemetry')
@Controller({path:'telemetry',version:'1'})
export class TelemetryController {
  constructor(@Inject(TelemetryService) private readonly telemetry:TelemetryService,@Inject(AnalyticsService) private readonly analytics:AnalyticsService) {}

  @Post()
  @UseGuards(IngestGuard)
  @ApiSecurity('ingest-key')
  @ApiOperation({summary:'Ingest a single validated reading (idempotent with eventId)'})
  @ApiBody({schema:{type:'object',example}})
  ingest(@Body() body:unknown) {return this.telemetry.ingest(body);}

  @Post('batch')
  @UseGuards(IngestGuard)
  @ApiSecurity('ingest-key')
  @ApiOperation({summary:'Sequential batch ingest, maximum 100, retry individual eventId values after partial failure'})
  @ApiBody({schema:{type:'object',example:{events:[example]}}})
  batch(@Body() body:unknown) {return this.telemetry.ingestBatch(body);}

  @Get('history')
  @ApiQuery({name:'chargerId',type:'string',required:true})
  @ApiQuery({name:'from',type:'string',required:true})
  @ApiQuery({name:'to',type:'string',required:true})
  @ApiQuery({name:'limit',type:'number',required:false})
  history(@Query() q:Record<string,string>) {return this.analytics.history(q);}
}
