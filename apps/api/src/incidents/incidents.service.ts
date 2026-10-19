import { recordIncidentAction } from './incident-audit';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ObservabilityService } from '../observability/observability.service';

@Injectable()
export class IncidentsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ObservabilityService) private readonly obs: ObservabilityService,
  ) {}

  async findAll(query?: { status?: string; chargerId?: string; limit?: number }) {
    const filter: Record<string, unknown> = {};
    if (query?.status) filter.status = query.status;
    if (query?.chargerId) filter.chargerId = query.chargerId;
    const limit = Math.min(query?.limit ?? 50, 100);

    return this.database
      .collection('incidents')
      .find(filter, { sort: { detectedAt: -1 }, limit })
      .toArray();
  }

  async findOne(id: string) {
    const incident = await this.database.collection('incidents').findOne({ _id: id });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);

    const actions = await this.database
      .collection('incident_actions')
      .find({ incidentId: id }, { sort: { at: 1 } })
      .toArray();

    return { ...incident, actions };
  }

  private validateMutation(id:string,actor:string):void {
    if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(id) || typeof actor!=='string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(actor)) {
      throw new BadRequestException('Invalid incident identifier or operator label.');
    }
  }

  private logAction(id:string,action:string):void {
    this.obs.record('info','demo.action',{action,...(/^demo-[a-f0-9]{12}$/.test(id)?{demo_id:id.slice(5),incident_id:id}:{})});
  }

  async acknowledge(id: string, actor = 'operator-console') {
    this.validateMutation(id,actor);
    const current=await this.database.collection('incidents').findOne({_id:id});
    if(!current) throw new NotFoundException('Incident not found');
    if(!['OPEN','ACKNOWLEDGED'].includes(current.status)) throw new ConflictException('Only an open incident can be acknowledged.');
    const updated=current.status==='ACKNOWLEDGED'?current:await this.database.collection('incidents').findOneAndUpdate(
      {_id:id,status:'OPEN'},{$set:{status:'ACKNOWLEDGED',acknowledgedAt:new Date(),updatedAt:new Date()}},{returnDocument:'after'});
    if(!updated) throw new ConflictException('Incident state changed; refresh before retrying.');
    await recordIncidentAction(this.database,id,actor,'acknowledged',new Date(updated.acknowledgedAt));
    this.logAction(id,'investigate');
    return updated;
  }

  async resolve(id: string, actor = 'operator-console') {
    this.validateMutation(id,actor);
    const current=await this.database.collection('incidents').findOne({_id:id});
    if(!current) throw new NotFoundException('Incident not found');
    if(current.status!=='RESOLVED' && (current.status!=='RESOLVING' || !current.recoveryTelemetryAt)) {
      throw new ConflictException('Submit successful recovery telemetry before resolving the incident.');
    }
    const updated=current.status==='RESOLVED'?current:await this.database.collection('incidents').findOneAndUpdate(
      {_id:id,status:'RESOLVING',recoveryTelemetryAt:{$exists:true}},{$set:{status:'RESOLVED',resolvedAt:new Date(),updatedAt:new Date()}},{returnDocument:'after'});
    if(!updated) throw new ConflictException('Incident state changed; refresh before retrying.');
    await recordIncidentAction(this.database,id,actor,'resolved',new Date(updated.resolvedAt));
    this.logAction(id,'resolved');
    return updated;
  }
}
