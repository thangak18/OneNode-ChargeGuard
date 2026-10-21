import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import { APP_CONFIG } from '../config/tokens';
import type { AppConfig } from '../config/config';
import { diagnoseAtlas } from '../database/atlas-diagnostics';

@Controller({path:'health',version:'1'})
export class AtlasDiagnosticsController {
  private pending?:ReturnType<typeof diagnoseAtlas>;
  private cached?:{at:number;value:Awaited<ReturnType<typeof diagnoseAtlas>>};
  constructor(@Inject(APP_CONFIG) private readonly config:AppConfig) {}
  @Get('atlas-diagnostics')
  async inspect() {
    const until=Date.parse(process.env.ATLAS_DIAGNOSTICS_UNTIL??'');
    if(process.env.VERCEL!=='1' || process.env.ATLAS_DIAGNOSTICS_ENABLED!=='true' || !Number.isFinite(until) || until<=Date.now() || until-Date.now()>30*60*1000)throw new NotFoundException();
    if(this.cached && Date.now()-this.cached.at<60000)return this.cached.value;
    if(!this.pending)this.pending=diagnoseAtlas(this.config).then(value=>{this.cached={at:Date.now(),value};return value;}).finally(()=>{this.pending=undefined;});
    return this.pending;
  }
}
