import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import { ObservabilityService } from './observability.service';
@Injectable()
export class IngestionMetricsMiddleware implements NestMiddleware {
  constructor(@Inject(ObservabilityService) private readonly obs:ObservabilityService){}
  use(req:Request,res:Response,next:NextFunction):void {
    const path=req.originalUrl.split('?')[0].replace(/\/$/,'');
    if(req.method==='POST' && ['/api/v1/telemetry','/api/v1/telemetry/batch'].includes(path)) {
      const start=performance.now();
      res.once('finish',()=>this.obs.ingestionRequest(res.statusCode,performance.now()-start,path.endsWith('/batch')));
    }
    next();
  }
}
