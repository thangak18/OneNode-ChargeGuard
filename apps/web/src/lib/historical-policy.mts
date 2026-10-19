/** Pure policy: local opt-in, read-only, development-only; unrelated to the cloud BFF. */
export function canReadHistorical(request:Request,nodeEnv:string|undefined,enabled:string|undefined):boolean {
  if(nodeEnv!=='development' || enabled!=='true' || !['GET','HEAD'].includes(request.method))return false;
  const url=new URL(request.url);const host=request.headers.get('host');
  if(!host || !['127.0.0.1','localhost','[::1]'].includes(url.hostname))return false;
  let requested:URL;
  try {requested=new URL(`${url.protocol}//${host}`);} catch{return false;}
  // Next may normalize request.url to localhost while retaining Host:127.0.0.1.
  // Validate both loopback aliases and ports instead of treating them as identical origins.
  if(!['127.0.0.1','localhost','[::1]'].includes(requested.hostname) || requested.username || requested.password || requested.pathname!=='/' || requested.search || requested.hash || requested.port!==url.port)return false;
  const site=request.headers.get('sec-fetch-site');if(site && !['same-origin','none'].includes(site))return false;
  const origin=request.headers.get('origin');if(origin && origin!==requested.origin)return false;
  return true;
}
