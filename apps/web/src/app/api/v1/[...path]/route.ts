import { isRenderOrigin, upstreamTimeoutMs, isJsonResponse, fetchWithDeadline } from '@/lib/upstream-policy.mts';
import { type NextRequest, NextResponse } from 'next/server';
import { isAllowedApiRoute, isLocalOperatorRequest } from '@/lib/bff-policy.mts';

// Route handlers that proxy live backend data must never be statically cached.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';
// Verified against this project's enabled Fluid Compute and Hobby 300-second ceiling.
export const maxDuration = 120;

const NEST_KEY = process.env.NEST_API_KEY;
const MAX_BODY_BYTES = 8 * 1024;
const STRIP_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'set-cookie',
]);

type MutationResult = { body?: string; error?: Response };

function badRequest(message: string, status = 400): Response {
  return NextResponse.json({ message }, { status });
}

async function readLimitedBody(request: NextRequest): Promise<string | null> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) return null;

  const reader = request.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validateMutationBody(path: string[], rawBody: string, contentType: string | null): MutationResult {
  const isDemoReset = path.length === 2 && path[0] === 'demo' && path[1] === 'reset';
  const isDemoTrigger = path.length === 2 && path[0] === 'demo' && path[1] === 'trigger-fault';
  const isDemoRecovery = path.length === 2 && path[0] === 'demo' && path[1] === 'recover';
  const isIncidentAction =
    path.length === 3 &&
    path[0] === 'incidents' &&
    (path[2] === 'acknowledge' || path[2] === 'resolve');

  if (rawBody && contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return { error: badRequest('Mutation requests must use application/json.', 415) };
  }

  if (!rawBody.trim()) {
    if (isDemoTrigger || isDemoReset) return { body: undefined };
    if (isIncidentAction) return { body: JSON.stringify({ actor: 'local-demo-operator' }) };
    return { error: badRequest('A JSON request body is required.') };
  }

  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return { error: badRequest('Request body must contain valid JSON.') };
  }
  if (!isRecord(value)) return { error: badRequest('Request body must be a JSON object.') };

  if (isDemoTrigger) {
    if (!hasOnlyKeys(value, ['chargerIndex', 'scenario'])) {
      return { error: badRequest('Unsupported fault trigger fields.') };
    }
    if (
      value.chargerIndex !== undefined &&
      (!Number.isInteger(value.chargerIndex) || Number(value.chargerIndex) < 1 || Number(value.chargerIndex) > 5)
    ) {
      return { error: badRequest('chargerIndex must be an integer from 1 through 5.') };
    }
    if (
      value.scenario !== undefined &&
      !['SIM_OVERHEAT', 'SIM_POWER_LOSS', 'SIM_HARDWARE_FAULT'].includes(String(value.scenario))
    ) {
      return { error: badRequest('Unsupported synthetic fault scenario.') };
    }
    return { body: JSON.stringify(value) };
  }

  if (isDemoRecovery) {
    if (
      !hasOnlyKeys(value, ['incidentId']) ||
      typeof value.incidentId !== 'string' ||
      !/^demo-[a-f0-9]{12}$/.test(value.incidentId)
    ) {
      return { error: badRequest('incidentId must identify a ChargeGuard demo incident.') };
    }
    return { body: JSON.stringify(value) };
  }

  if (isDemoReset) {
    if (Object.keys(value).length > 0) return { error: badRequest('Demo reset does not accept request fields.') };
    return { body: JSON.stringify(value) };
  }

  if (isIncidentAction) {
    if (
      !hasOnlyKeys(value, ['actor']) ||
      (value.actor !== undefined &&
        (typeof value.actor !== 'string' || value.actor.length < 1 || value.actor.length > 64))
    ) {
      return { error: badRequest('Incident action accepts only an optional actor label up to 64 characters.') };
    }
    return { body: JSON.stringify({ actor: 'local-demo-operator' }) };
  }

  return { error: badRequest('Unsupported API operation.', 404) };
}

function getNestBase(): URL {
  const configured = process.env.NEST_API_BASE_URL;
  if (process.env.NODE_ENV === 'production' && !configured) {
    throw new Error('NEST_API_BASE_URL is required in production.');
  }
  const base = new URL(configured || 'http://127.0.0.1:3001');
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password || base.pathname !== '/' || !!base.search || !!base.hash ||
    (process.env.NODE_ENV === 'production' && base.protocol !== 'https:')
  ) {
    throw new Error('NEST_API_BASE_URL must be an HTTP(S) origin without credentials; production requires HTTPS.');
  }
  return base;
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  if (!isAllowedApiRoute(request.method, path)) {
    return badRequest('Unsupported API operation.', 404);
  }

  const isMutation = request.method !== 'GET' && request.method !== 'HEAD';
  let mutationBody: string | undefined;
  let mutationKey: string | undefined;
  if (isMutation) {
    if (!isLocalOperatorRequest(request, process.env.NODE_ENV)) {
      return badRequest('Mutations are available only from the local development operator interface.', 403);
    }
    if (!NEST_KEY) return badRequest('Mutation service is not configured.', 503);
    mutationKey = NEST_KEY;

    const rawBody = await readLimitedBody(request);
    if (rawBody === null) return badRequest('Request body exceeds the 8 KB limit.', 413);
    const validation = validateMutationBody(path, rawBody, request.headers.get('content-type'));
    if (validation.error) return validation.error;
    mutationBody = validation.body;
  }

  const headers = new Headers();
  if (process.env.NODE_ENV === 'production') {
    const readKey = process.env.NEST_READ_API_KEY;
    if (!readKey || readKey.length < 32) return badRequest('Read service is not configured.', 503);
    headers.set('x-chargeguard-read-key', readKey);
  }
  headers.set('accept', 'application/json');
  if (mutationBody !== undefined) headers.set('content-type', 'application/json');
  if (mutationKey) headers.set('x-api-key', mutationKey);

  try {
    const safePath = path.map((segment) => encodeURIComponent(segment)).join('/');
    const origin = getNestBase();
    const target = new URL(`/api/v1/${safePath}`, origin);
    target.search = request.nextUrl.search;
    const upstream = await fetchWithDeadline(target, {
      method: request.method,
      headers,
      body: mutationBody,
    },request.signal,upstreamTimeoutMs(origin,request.method));
    if (upstream.status >= 300 && upstream.status < 400) {
      return badRequest('ChargeGuard API returned an unexpected redirect.', 502);
    }

    if (!isMutation && isRenderOrigin(origin) && !isJsonResponse(upstream.headers.get('content-type'))) {
      await upstream.body?.cancel();
      return NextResponse.json({message:'The backend is starting or temporarily unavailable. Please retry shortly.',code:'BACKEND_NOT_READY'}, {status:503,headers:{'Retry-After':'15','Cache-Control':'no-store'}});
    }
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!STRIP_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    if (request.signal.aborted) return new Response(null,{status:499});
    if (!isMutation) {
      return NextResponse.json({message:'The backend is starting or temporarily unavailable. Please retry shortly.',code:'BACKEND_NOT_READY'}, {status:503,headers:{'Retry-After':'15','Cache-Control':'no-store'}});
    }
    return badRequest('ChargeGuard API proxy could not reach the NestJS backend.', 502);
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export const GET = handle;
export const POST = handle;
