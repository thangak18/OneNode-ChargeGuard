import { Global, Module } from '@nestjs/common';
import { ObservabilityService, observabilityConfig } from './observability.service';
@Global()
@Module({providers:[{provide:ObservabilityService,useFactory:()=>new ObservabilityService(observabilityConfig(process.env))}],exports:[ObservabilityService]})
export class ObservabilityModule {}
