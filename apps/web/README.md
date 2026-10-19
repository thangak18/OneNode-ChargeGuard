# ChargeGuard Web

The Next.js App Router frontend for the ChargeGuard EV operations dashboard.
It provides Operations Overview, Charger Detail, Incident Management, and Demo
Control Center pages.

## Local development

1. Configure the NestJS API using the repository-root `.env` file and start
   the API from `apps/api`.
2. Copy `.env.example` to `.env.local` in this directory and set `NEST_API_KEY`
   to the API's `INGEST_API_KEY`. Keep both files private.
3. Start the frontend:

```bash
cd apps/web
npm ci
npm run dev
```

The development server binds to `127.0.0.1` and is not exposed to the LAN.
Open <http://127.0.0.1:3000>. The BFF proxies supported read requests and
controlled mutations to the NestJS API; the browser never receives the API key.

## Local-only mutation boundary

Mutating requests are intentionally restricted to the local development
interface: they require a same-origin request from a loopback host, are limited
to an explicit route/method allowlist, and have bounded, validated JSON bodies.
The BFF rejects every mutation when `NODE_ENV=production`. This is a local
hackathon demo boundary, not operator authentication. Do not expose the app or
enable remote mutations until real operator authentication, authorization, and
deployment-appropriate CSRF and rate-limit protections are implemented.

Production read-only API access requires an explicit HTTPS
`NEST_API_BASE_URL`. Do not put credentials in `NEXT_PUBLIC_*` variables.

## Checks

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```
