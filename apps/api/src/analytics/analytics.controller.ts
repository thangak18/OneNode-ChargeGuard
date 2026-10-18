import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller({path:'analytics',version:'1'})
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics:AnalyticsService){}
  @Get('latest') @ApiOperation({summary:'Latest telemetry for each charger within a bounded time window'})
  latest(@Query() query:Record<string,string>){return this.analytics.latest(query);}
  @Get('current-averages') @ApiOperation({summary:'Average current (A) by bucket for one charger; bucketMinutes 1–60'})
  averages(@Query() query:Record<string,string>){return this.analytics.currentAverages(query);}
  @Get('states') @ApiOperation({summary:'Synthetic application charging-state distribution by event count'})
  states(@Query() query:Record<string,string>){return this.analytics.states(query);}
  @Get('activity') @ApiOperation({summary:'Active/inactive virtual chargers by recent telemetry presence'})
  activity(@Query() query:Record<string,string>){return this.analytics.activity(query);}
  @Get('stations/:stationId/summary') @ApiOperation({summary:'Station summary combining configured assets with bounded current telemetry'})
  summary(@Param('stationId') stationId:string,@Query() query:Record<string,string>){return this.analytics.stationSummary(stationId,query);}
}
