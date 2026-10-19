import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChargersService } from './chargers.service';

@ApiTags('Chargers')
@Controller({ path: 'chargers', version: '1' })
export class ChargersController {
  constructor(@Inject(ChargersService) private readonly chargers: ChargersService) {}

  @Get()
  @ApiOperation({ summary: 'List all virtual chargers' })
  findAll() {
    return this.chargers.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get virtual charger metadata by ID' })
  findOne(@Param('id') id: string) {
    return this.chargers.findOne(id);
  }
}

@ApiTags('Stations')
@Controller({ path: 'stations', version: '1' })
export class StationsController {
  constructor(@Inject(ChargersService) private readonly chargers: ChargersService) {}

  @Get()
  @ApiOperation({ summary: 'List all charging stations' })
  findAll() {
    return this.chargers.findStations();
  }
}
