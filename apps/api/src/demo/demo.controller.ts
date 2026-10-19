import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DemoService } from './demo.service';
import { IngestGuard } from '../telemetry/ingest.guard';

@ApiTags('Demo Controls')
@Controller({ path: 'demo', version: '1' })
@UseGuards(IngestGuard)
@ApiSecurity('ingest-key')
export class DemoController {
  constructor(@Inject(DemoService) private readonly demo: DemoService) {}

  @Post('trigger-fault')
  @ApiOperation({ summary: 'Trigger synthetic fault scenario on virtual charger (idempotent per active incident)' })
  triggerFault(@Body() body?: { chargerIndex?: number; scenario?: string }) {
    return this.demo.triggerFault(body?.chargerIndex ?? 1, body?.scenario ?? 'SIM_OVERHEAT');
  }

  @Post('recover')
  @ApiOperation({ summary: 'Send recovery telemetry for active synthetic incident' })
  recover(@Body() body: { incidentId: string }) {
    return this.demo.recover(body.incidentId);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset all virtual chargers to baseline charging telemetry' })
  reset() {
    return this.demo.reset();
  }
}
