import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG } from '../config/tokens';
import { AppConfig } from '../config/config';

@Injectable()
export class IngestGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config:AppConfig) {}
  canActivate(context:ExecutionContext):boolean {
    const expected=this.config.ingestApiKey;
    if (!expected) throw new UnauthorizedException('Ingest API key is not configured');
    const supplied=context.switchToHttp().getRequest().headers['x-api-key'];
    if(typeof supplied !== 'string') throw new UnauthorizedException('Invalid ingest API key');
    const hash=(s:string)=>createHash('sha256').update(s).digest();
    if (!timingSafeEqual(hash(expected),hash(supplied))) throw new UnauthorizedException('Invalid ingest API key');
    return true;
  }
}
