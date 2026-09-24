'use client';

import { useAuthRecovery } from '@/app/components/useAuthRecovery';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RecommendationRecord } from '@/lib/types';
export default function RecommendationsPage() {
  const { request, recovery, retryVersion } = useAuthRecovery();
  const [records, setRecords] = useState<Omit<RecommendationRecord, 'resumeText'>[]>([]);
  const [message, setMessage] = useState('加载中…');
  const [busy, setBusy] = useState(false);
  function load() {
    request('/api/recommendations').then((r) => r.json()).then((b) => { if (b.ok) { setRecords(b.data); setMessage(''); } else setMessage(b.message); }).catch(() => setMessage('加载失败，请重试'));
  }
  useEffect(load, [request, retryVersion]);
  async function clear() {
    if (!window.confirm('清空当前账户的全部推荐记录及推荐快照？训练和导入岗位不受影响。')) return;
    setBusy(true);
    try { const result = await request('/api/recommendations', { method: 'DELETE' }); const body = await result.json(); if (body.ok) load(); else setMessage(body.message); }
    catch { setMessage('清空失败，请重试'); } finally { setBusy(false); }
  }
  return <div className="space-y-5">{recovery}<h1 className="text-2xl font-semibold">推荐历史</h1><p className="text-sm text-slate-500">保留当时的岗位匹配结果。清空推荐记录也会清理对应推荐快照，训练和导入岗位保留。</p>{message ? <p role="alert">{message}<button className="ml-3 underline" onClick={load}>重新加载</button></p> : null}{!message && !records.length ? <p>暂无推荐记录。</p> : null}{records.map((record) => <section key={record.id} className="cf-section p-5"><p className="text-xs text-slate-500">{new Date(record.createdAt).toLocaleString('zh-CN')}</p><ul className="mt-3 space-y-2">{record.recommendations.map((item) => <li key={item.role.id}><Link href={`/resume?roleId=${encodeURIComponent(item.role.id)}`} className="font-medium underline">{item.role.name}</Link> · 匹配分 {item.score}<p className="text-sm text-slate-500">{item.reason}</p></li>)}</ul></section>)}<button disabled={busy || !records.length} onClick={clear} className="cf-button-secondary px-4 py-2 disabled:opacity-50">{busy ? '清空中…' : '清空推荐记录'}</button><Link href="/records" className="ml-4 underline">返回训练记录</Link></div>;
}
