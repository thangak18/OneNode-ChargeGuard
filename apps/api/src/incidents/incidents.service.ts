import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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

  async acknowledge(id: string, actor = 'operator-console') {
    const at = new Date();
    const updated = await this.database.collection('incidents').findOneAndUpdate(
      { _id: id },
      { $set: { status: 'ACKNOWLEDGED', acknowledgedAt: at } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new NotFoundException(`Incident ${id} not found`);

    await this.database.collection('incident_actions').insertOne({
      incidentId: id,
      actor,
      action: 'acknowledged',
      at,
      synthetic: true,
    });

    this.obs.record('info', 'demo.action', { action: 'investigate' });
    return updated;
  }

  async resolve(id: string, actor = 'operator-console') {
    const at = new Date();
    const updated = await this.database.collection('incidents').findOneAndUpdate(
      { _id: id },
      { $set: { status: 'RESOLVED', resolvedAt: at } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new NotFoundException(`Incident ${id} not found`);

    await this.database.collection('incident_actions').insertOne({
      incidentId: id,
      actor,
      action: 'resolved',
      at,
      synthetic: true,
    });

    this.obs.record('info', 'demo.action', { action: 'resolved' });
    return updated;
  }
}
