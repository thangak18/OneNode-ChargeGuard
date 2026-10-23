import { isHostedRuntime } from '../config/runtime';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { isScopedJudgeWrite } from './judge-production-gate';

/** Production Stage A: service-authenticated reads only, independent of the UI. */
export function deploymentPolicy(env: NodeJS.ProcessEnv) {
  const restricted = env.NODE_ENV === 'production' || isHostedRuntime(env);
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
    if (!['GET', 'HEAD'].includes(req.method) &&
        !(isScopedJudgeWrite(env, req.method, req.path) && req.originalUrl === req.path)) {
      res.status(403).json({message: 'This deployment is read-only.'}); return;
    }
    // The one possible judge POST is independently authenticated by the controller
    // using a distinct write credential and a signed owner/route/body-bound assertion.
    if (isScopedJudgeWrite(env, req.method, req.path)) { next(); return; }
    // Render's unauthenticated platform probe exposes no database or configuration data.
    // Write denial above also applies to this path. API health/readiness remain private.
    if (env.RENDER === 'true' && req.path === '/healthz') {
      res.status(200).json({status:'ok'}); return;
    }
    const supplied = req.headers['x-chargeguard-read-key'];
    if (typeof supplied !== 'string' || !timingSafeEqual(digest(key!), digest(supplied))) {
      res.status(401).json({message: 'Service authentication required.'}); return;
    }
    next();
  };
}
