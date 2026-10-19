const READ_ONLY_ROUTES = new Set([
  'health/live',
  'health/ready',
  'stations',
  'chargers',
  'analytics/latest',
  'analytics/states',
  'telemetry/history',
  'incidents',
]);

function isResourceId(segment: string | undefined): segment is string {
  return !!segment && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(segment);
}

export function isAllowedApiRoute(method: string, path: string[]): boolean {
  const normalizedMethod = method.toUpperCase();
  const route = path.join('/');

  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') {
    return (
      READ_ONLY_ROUTES.has(route) ||
      (path.length === 2 && path[0] === 'chargers' && isResourceId(path[1])) ||
      (path.length === 4 &&
        path[0] === 'analytics' &&
        path[1] === 'stations' &&
        isResourceId(path[2]) &&
        path[3] === 'summary') ||
      (path.length === 2 && path[0] === 'incidents' && isResourceId(path[1]))
    );
  }

  if (normalizedMethod !== 'POST') return false;
  if (
    path.length === 2 &&
    path[0] === 'demo' &&
    ['trigger-fault', 'recover', 'reset'].includes(path[1])
  ) {
    return true;
  }
  return (
    path.length === 3 &&
    path[0] === 'incidents' &&
    isResourceId(path[1]) &&
    ['acknowledge', 'resolve'].includes(path[2])
  );
}

function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  try {
    const url = new URL(`http://${host}`);
    return (
      !url.username &&
      !url.password &&
      (url.hostname.toLowerCase() === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]')
    );
  } catch {
    return false;
  }
}

export function isLocalOperatorRequest(request: Request, nodeEnv = process.env.NODE_ENV): boolean {
  if (nodeEnv !== 'development') return false;

  const host = request.headers.get('host');
  const originHeader = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (!isLoopbackHost(host) || !originHeader || (fetchSite && fetchSite !== 'same-origin')) return false;

  try {
    const origin = new URL(originHeader);
    const requestUrl = new URL(request.url);
    return (
      isLoopbackHost(origin.host) &&
      origin.pathname === '/' &&
      !origin.search &&
      !origin.hash &&
      origin.protocol === requestUrl.protocol &&
      origin.host.toLowerCase() === host?.toLowerCase()
    );
  } catch {
    return false;
  }
}
