'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
export function AccountLink() {
  const [state, setState] = useState<{ enabled: boolean; signedIn: boolean } | null>(null);
  useEffect(() => { fetch('/api/auth').then((r) => r.json()).then((b) => { if (b.ok) setState(b.data); }).catch(() => undefined); }, []);
  if (state && !state.enabled) return null;
  return state?.signedIn ? <button className="px-3 py-1.5" onClick={async () => { const response = await fetch('/api/auth', { method: 'DELETE' }); if (response.ok) window.location.href = '/login'; }}>退出登录</button> : <Link className="px-3 py-1.5" href="/login">登录</Link>;
}
