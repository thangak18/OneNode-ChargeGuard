import { isHostedRuntime } from './runtime';
import { resolve } from 'node:path';
import { config as readDotEnv } from 'dotenv';
import { z } from 'zod';
import {setServers} from 'node:dns';
import {isIP} from 'node:net';

export type AppConfig = {
  mongoUri: string;
  mongoDatabase: string;
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  ingestApiKey?: string;
};

export function loadLocalEnv(): void {
  // Commands execute from apps/api; always use the repository root .env.
  if (!isHostedRuntime(process.env)) readDotEnv({ path: resolve(__dirname, '../../../../.env'), quiet: true });
  // Opt-in DNS override for SRV queries on mobile hotspots returning EBADRESP.
  // In-process only: never changes OS DNS or Atlas network-access rules.
  const override=process.env.MONGODB_DNS_SERVERS;
  if(override) {
    const servers=override.split(',').map(s=>s.trim());
    if(!servers.length || servers.some(s=>!isIP(s))) throw new Error('Invalid MONGODB_DNS_SERVERS: use comma-separated IP addresses');
    setServers(servers);
  }
}

export function validateConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = z.object({
    MONGODB_URI: z.string().min(1),
    MONGODB_DATABASE: z.literal('chargeguard'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    INGEST_API_KEY: z.string().min(24).optional()
  }).safeParse(env);
  if (!parsed.success) throw new Error('Invalid environment: check MONGODB_URI, MONGODB_DATABASE, PORT and optional INGEST_API_KEY.');
  const { MONGODB_URI: uri, MONGODB_DATABASE: database, NODE_ENV: nodeEnv, PORT: port, INGEST_API_KEY: ingestApiKey } = parsed.data;
  let url: URL;
  try { url = new URL(uri); } catch { throw new Error('Invalid MONGODB_URI format.'); }
  if (url.protocol !== 'mongodb+srv:' || !url.hostname.endsWith('.mongodb.net') || !!url.port || !url.username || !url.password || /<|>|\$\{|placeholder|change.me/i.test(uri)) {
    throw new Error('MONGODB_URI must be a fully configured Atlas SRV URI.');
  }
  if (url.pathname !== '' && url.pathname !== '/' && url.pathname !== '/chargeguard') throw new Error('URI database must be chargeguard.');
  if (['tls', 'ssl'].some(key => url.searchParams.get(key)?.toLowerCase() === 'false') ||
      ['tlsInsecure', 'tlsAllowInvalidCertificates', 'tlsAllowInvalidHostnames'].some(key => url.searchParams.get(key)?.toLowerCase() === 'true')) {
    throw new Error('TLS validation cannot be disabled.');
  }
  if (isHostedRuntime(env) && nodeEnv !== 'production') throw new Error('Hosted runtimes require NODE_ENV=production.');
  if (nodeEnv !== 'test' && !ingestApiKey) throw new Error('INGEST_API_KEY must be configured for the API.');
  return { mongoUri: uri, mongoDatabase: database, port, nodeEnv, ingestApiKey };
}
