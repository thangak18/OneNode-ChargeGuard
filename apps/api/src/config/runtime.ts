/** Provider flags are assigned by the hosting platform, never by browser input. */
export function isHostedRuntime(env: NodeJS.ProcessEnv): boolean {
  return env.VERCEL === '1' || env.RENDER === 'true';
}
export function listenHost(env: NodeJS.ProcessEnv): '0.0.0.0' | '127.0.0.1' {
  return isHostedRuntime(env) ? '0.0.0.0' : '127.0.0.1';
}
