import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** Production Stage A: service-authenticated reads only, independent of the UI. */
export function deploymentPolicy(env: NodeJS.ProcessEnv) {
  const restricted = env.NODE_ENV === 'production' || env.VERCEL === '1';
  const key = env.BFF_READ_API_KEY;
  if (restricted && (!key || key.length < 32)) throw new Error('BFF_READ_API_KEY is required (minimum 32 characters).');
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!restricted) { next(); return; }
    if (req.path === '/docs' || req.path.startsWith('/docs/') || req.path === '/docs-json') {
      res.status(404).json({message: 'Not found'}); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.status(403).json({message: 'This deployment is read-only.'}); return;
    }
    const supplied = req.headers['x-chargeguard-read-key'];
    if (typeof supplied !== 'string' || !timingSafeEqual(digest(key!), digest(supplied))) {
      res.status(401).json({message: 'Service authentication required.'}); return;
    }
    next();
  };
}
