'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recovered, setRecovered] = useState(false);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (result.ok) {
        if (new URLSearchParams(window.location.search).get('recovery') === '1') setRecovered(true);
        else window.location.href = '/records';
      }
      else setMessage(result.message ?? '登录失败');
    } catch { setMessage('网络异常，请重试'); }
    finally { setBusy(false); setPassword(''); }
  }
  if (recovered) return <div role="status" className="cf-section mx-auto max-w-md space-y-3 p-6"><h1 className="text-xl font-semibold">登录成功</h1><p>请返回原来的训练页面，点击“已登录，重新加载”后继续。原页面的输入仍保留。</p></div>;
  return <form onSubmit={login} className="cf-section mx-auto max-w-md space-y-4 p-6"><h1 className="text-xl font-semibold">登录训练账户</h1><p className="text-sm text-slate-500">使用试用邀请中的账户登录。训练记录仅对当前账户可见。</p><label className="block text-sm">邮箱<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="cf-input mt-1 w-full p-3" /></label><label className="block text-sm">密码<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="cf-input mt-1 w-full p-3" /></label><button disabled={busy} className="cf-button-primary w-full p-3">{busy ? '登录中…' : '登录'}</button>{message ? <p role="alert" className="text-sm text-rose-700">{message}</p> : null}</form>;
}
