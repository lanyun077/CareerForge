// 构建完成后运行：启动隔离服务、验证、退出时清理本次进程。
import { spawn } from 'node:child_process';
import net from 'node:net';
const basePort = Number(process.argv[2] || 3210);
if (!Number.isInteger(basePort) || basePort < 1024 || basePort > 65532) throw new Error('Invalid test base port');
const base = (offset = 0) => `http://127.0.0.1:${basePort + offset}`;
async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Test port ${port} is occupied; no tests were started`)));
    server.listen(port, () => server.close(resolve));
  });
}
const children = [];
const logs = [];
function start(args, env = {}) {
  const child = spawn(process.execPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ASR_API_KEY: ' ', OPENAI_API_KEY: ' ', OCR_API_KEY: ' ', DATABASE_URL: ' ', AUTH_MODE: 'local-demo', ...env } });
  let output = '';
  child.stdout.on('data', (chunk) => { output = (output + chunk).slice(-6000); });
  child.stderr.on('data', (chunk) => { output = (output + chunk).slice(-6000); });
  children.push(child);
  logs.push(() => `${args.join(' ')}\n${output}`);
  return { child, output: () => output };
}
async function waitServer(port, process, path = '/api/health', expectedStatus = 200) {
  for (let i = 0; i < 100; i++) {
    if (process.child.exitCode !== null) throw new Error(process.output());
    try { if ((await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(2000) })).status === expectedStatus) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server ${port} not ready: ${process.output()}`);
}
async function run(args) {
  const { child, output } = start(args);
  const code = await new Promise((resolve) => child.on('exit', resolve));
  console.log(output());
  if (code !== 0) throw new Error(`${args[0]} failed (${code})`);
}
try {
  for (const port of [basePort, basePort + 1, basePort + 2, basePort + 3, 3997, 3998, 3999]) await requireFreePort(port);
  await waitServer(3999, start(['scripts/mock-llm.mjs', '3999']));
  await waitServer(3998, start(['scripts/mock-llm.mjs', '3998', '--garbage']));
  await waitServer(3997, start(['scripts/mock-auth.mjs']), '/auth/v1/user', 401);
  const configs = [
    [basePort + 0, {}],
    [basePort + 1, { OPENAI_API_KEY: 'mock', OPENAI_BASE_URL: 'http://127.0.0.1:3999/v1' }],
    [basePort + 2, { OPENAI_API_KEY: 'mock', OPENAI_BASE_URL: 'http://127.0.0.1:3998/v1' }],
    [basePort + 3, { AUTH_MODE: 'supabase', SUPABASE_URL: 'http://127.0.0.1:3997', SUPABASE_ANON_KEY: 'test' }],
  ];
  for (const [port, env] of configs) await waitServer(port, start(['node_modules/next/dist/bin/next', 'start', '-p', String(port)], env));
  await run(['scripts/gen-test-pdf.cjs']);
  await run(['scripts/test-core.cjs']);
  await run(['scripts/test-job-collection.cjs']);
  await run(['scripts/test-job-provenance.cjs']);
  await run(['scripts/test-job-parsing.cjs']);
  await run(['scripts/test-postgres.cjs']);
  await run(['scripts/smoke.mjs', base()]);
  await run(['scripts/smoke-baseline.mjs', base()]);
  await run(['scripts/smoke-docx.mjs', base()]);
  await run(['scripts/smoke-answer-state.mjs', base()]);
  await run(['scripts/smoke-settings.mjs', base()]);
  await run(['scripts/smoke-job-source.mjs', base()]);
  await run(['scripts/smoke-llm.mjs', base(1), '--expect', 'llm']);
  await run(['scripts/smoke-llm.mjs', base(2), '--expect', 'fallback']);
  await run(['scripts/smoke-auth.mjs', base(3)]);
  console.log('全部本地自动检查通过。真实认证、数据库和模型质量需另行验收。');
} catch (error) { console.error(error); for (const log of logs) console.error(log()); process.exitCode = 1; }
finally { for (const child of children) if (child.exitCode === null) child.kill(); }
