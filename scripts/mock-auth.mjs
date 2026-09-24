// 本地测试专用 Supabase Auth 协议桩，不用于部署。
import http from 'node:http';
http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  let data;
  try { data = JSON.parse(body || '{}'); } catch { data = {}; }
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/auth/v1/user' && ['Bearer token-alice', 'Bearer token-bob'].includes(req.headers.authorization)) {
    res.end(JSON.stringify({ id: req.headers.authorization.slice(13) }));
  } else if (req.url === '/auth/v1/token?grant_type=password' && ['alice@test.invalid', 'bob@test.invalid'].includes(data.email) && data.password === 'test-only-password') {
    res.end(JSON.stringify({ access_token: `token-${data.email.split('@')[0]}`, expires_in: 3600 }));
  } else { res.statusCode = 401; res.end('{}'); }
}).listen(3997, '127.0.0.1', () => console.log('Mock auth listening on 127.0.0.1:3997'));
