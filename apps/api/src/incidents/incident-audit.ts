import { MongoServerError } from 'mongodb';
import { DatabaseService } from '../database/database.service';

/** Stable action identity makes ordinary HTTP retries append at most one audit event. */
export async function recordIncidentAction(database:DatabaseService,incidentId:string,actor:string,action:string,at:Date):Promise<void> {
  try {
    await database.collection('incident_actions').insertOne({_id:`${incidentId}:${action}`,incidentId,actor,action,at,synthetic:true});
  } catch(error) {
    if(!(error instanceof MongoServerError && error.code===11000)) throw error;
  }
}
