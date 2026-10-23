const https = require('node:https');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const next = createRequire(process.cwd() + '/package.json')('next');

async function main() {
  const port = Number(process.env.PORT);
  const app = next({ dev: true, dir: process.cwd(), hostname: '127.0.0.1', port, turbopack: true });
  await app.prepare();
  const handle = app.getRequestHandler();
  const server = https.createServer({
    key: fs.readFileSync(process.env.FIXTURE_TLS_KEY), cert: fs.readFileSync(process.env.FIXTURE_TLS_CERT),
  }, (req, res) => {
    handle(req, res);
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  process.send?.({ kind: 'ready' });
  process.on('message', message => {
    if (message?.kind === 'rearm' && typeof message.enabled === 'boolean') {
      process.env.JUDGE_REARM_ENABLED = String(message.enabled);
      process.send?.({ kind: 'rearm', enabled: message.enabled });
    }
  });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await app.close(); process.exit(0);
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop); process.on('disconnect', stop);
}
main().catch(error => { console.error(error); process.exit(1); });
