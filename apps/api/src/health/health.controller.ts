import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';

@ApiTags('Health')
@Controller({path:'health',version:'1'})
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly db:DatabaseService) {}
  @Get('live') live(){return {status:'ok'};}
  @Get('ready') async ready(){if(!await this.db.ping()) throw new ServiceUnavailableException('Database unavailable');return {status:'ready',database:'connected'};}
}
