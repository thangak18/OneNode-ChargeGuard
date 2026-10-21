export function isRenderOrigin(origin: URL): boolean {
  return origin.protocol === 'https:' && origin.hostname.endsWith('.onrender.com');
}
export function upstreamTimeoutMs(origin: URL, method: string): number {
  return isRenderOrigin(origin) && ['GET','HEAD'].includes(method.toUpperCase()) ? 85_000 : 20_000;
}
export function isJsonResponse(contentType: string | null): boolean {
  return /^application\/(?:[a-z0-9.-]+\+)?json(?:\s*;|$)/i.test(contentType ?? '');
}
export function fetchWithDeadline(target:URL, init:RequestInit, signal:AbortSignal, timeoutMs:number):Promise<Response> {
  return fetch(target, {...init,cache:'no-store',redirect:'manual',signal:AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)])});
}
