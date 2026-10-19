import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { IngestGuard } from '../telemetry/ingest.guard';

@ApiTags('Incidents')
@Controller({ path: 'incidents', version: '1' })
export class IncidentsController {
  constructor(@Inject(IncidentsService) private readonly incidents: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List incidents with optional status or chargerId filter' })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'RESOLVING'] })
  @ApiQuery({ name: 'chargerId', required: false, type: 'string' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  findAll(@Query() query: { status?: string; chargerId?: string; limit?: number }) {
    return this.incidents.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get incident details with audit timeline actions' })
  findOne(@Param('id') id: string) {
    return this.incidents.findOne(id);
  }

  @Post(':id/acknowledge')
  @UseGuards(IngestGuard)
  @ApiSecurity('ingest-key')
  @ApiOperation({ summary: 'Simulate operator acknowledgment for an active incident' })
  acknowledge(@Param('id') id: string, @Body() body?: { actor?: string }) {
    return this.incidents.acknowledge(id, body?.actor);
  }

  @Post(':id/resolve')
  @UseGuards(IngestGuard)
  @ApiSecurity('ingest-key')
  @ApiOperation({ summary: 'Simulate operator resolution and close incident' })
  resolve(@Param('id') id: string, @Body() body?: { actor?: string }) {
    return this.incidents.resolve(id, body?.actor);
  }
}
