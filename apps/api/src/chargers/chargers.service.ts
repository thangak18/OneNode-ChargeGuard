import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ChargersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findAll() {
    return this.database
      .collection('chargers')
      .find({}, { projection: { _id: 1, stationId: 1, connectorId: 1, status: 1, ratedPowerKW: 1 } })
      .toArray();
  }

  async findOne(id: string) {
    const charger = await this.database.collection('chargers').findOne({ _id: id });
    if (!charger) throw new NotFoundException(`Charger ${id} not found`);
    return charger;
  }

  async findStations() {
    return this.database.collection('stations').find({}).toArray();
  }
}
