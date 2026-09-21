'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/app/components/Section';
import type { SessionSummary } from '@/lib/types';

type Filter = 'all' | 'active' | 'completed';

export default function RecordsPage() {
  const [records, setRecords] = useState<SessionSummary[] | null>(null);
  const [deleting, setDeleting] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  function load() {
    setError('');
    fetch('/api/records').then((r) => r.json()).then((b) => b.ok ? setRecords(b.data as SessionSummary[]) : setError(b.message ?? '记录加载失败')).catch(() => setError('网络异常，请刷新重试'));
  }
  useEffect(load, []);

  async function remove(id: string) {
    setDeleting(id); setError('');
    try { const res = await fetch(`/api/records?id=${id}`, { method: 'DELETE' }); const body = await res.json(); if (!body.ok) setError(body.message ?? '删除失败'); else load(); } catch { setError('网络异常，删除失败'); } finally { setDeleting(''); }
  }

  const visible = useMemo(() => (records ?? []).filter((r) => (filter === 'all' || r.status === filter) && (!query.trim() || r.roleName.toLowerCase().includes(query.trim().toLowerCase()))), [records, filter, query]);
  const completed = (records ?? []).filter((r) => r.status === 'completed');
  const average = completed.length ? Math.round(completed.reduce((sum, r) => sum + (r.overallScore ?? 0), 0) / completed.length * 10) / 10 : 0;

  return <div className="space-y-5">
    <section className="cf-hero-panel"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="cf-eyebrow text-[#8be0d6]">TRAINING ARCHIVE</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">训练记录</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">把每次岗位训练留下来，回看回答证据，确认下一次练习是否真正变好。</p></div><Link href="/resume" className="rounded-md bg-[#64c7bd] px-4 py-2.5 text-sm font-semibold text-[#172033] hover:bg-[#8be0d6]">开始新训练 →</Link></div><div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4"><div className="cf-stat"><span>全部训练</span><strong>{records?.length ?? '—'}</strong></div><div className="cf-stat"><span>已完成</span><strong>{records ? completed.length : '—'}</strong></div><div className="cf-stat"><span>平均表现分</span><strong>{records ? (average || '—') : '—'}</strong></div><div className="cf-stat"><span>进行中</span><strong>{records ? records.filter((r) => r.status === 'active').length : '—'}</strong></div></div></section>

    <section className="cf-section p-4 md:p-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs"><button onClick={() => setFilter('all')} className={`rounded-md px-3 py-2 ${filter === 'all' ? 'bg-white font-semibold text-slate-800 shadow-sm' : 'text-slate-500'}`}>全部</button><button onClick={() => setFilter('active')} className={`rounded-md px-3 py-2 ${filter === 'active' ? 'bg-white font-semibold text-slate-800 shadow-sm' : 'text-slate-500'}`}>进行中</button><button onClick={() => setFilter('completed')} className={`rounded-md px-3 py-2 ${filter === 'completed' ? 'bg-white font-semibold text-slate-800 shadow-sm' : 'text-slate-500'}`}>已完成</button></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索岗位名称" className="cf-input w-full p-2.5 text-sm md:max-w-xs" /></div></section>

    {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
    <section className="cf-section overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="cf-eyebrow">SESSION LOG</p><h2 className="mt-1 text-base font-semibold text-slate-800">训练明细</h2></div><span className="text-xs text-slate-400">显示 {visible.length} 条</span></div>{records === null ? <div className="cf-loading p-8">加载训练记录…</div> : visible.length === 0 ? <div className="cf-empty m-5"><p className="text-sm text-slate-600">{records.length ? '没有符合当前筛选条件的记录。' : '还没有训练记录。'}</p><Link href="/resume" className="cf-button-primary mt-4 inline-block px-4 py-2 text-sm font-semibold">开始第一次训练</Link></div> : <div className="divide-y divide-slate-100">{visible.map((r) => <article key={r.id} className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-slate-50/70 md:flex-row md:items-center md:justify-between"><div className="flex min-w-0 items-start gap-3"><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${r.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-400'}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-slate-800">{r.roleName}</h3>{r.status === 'completed' ? <Badge tone="green">已完成</Badge> : <Badge tone="amber">进行中</Badge>}</div><p className="mt-1 text-xs text-slate-400">{new Date(r.startedAt).toLocaleString('zh-CN', { hour12: false })} · 第 {r.round} 轮 · {r.questionCount} 道问题</p></div></div><div className="flex items-center justify-between gap-5 md:justify-end"><div className="text-left md:text-right"><p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">score</p><p className="text-xl font-bold tabular-nums text-slate-700">{r.overallScore !== undefined ? r.overallScore : '—'}</p></div><div className="flex items-center gap-2 text-xs"><Link href={r.status === 'completed' ? `/report/${r.id}` : `/interview?sessionId=${r.id}`} className="cf-button-secondary px-3 py-2 font-medium">{r.status === 'completed' ? '查看报告' : '继续训练'}</Link><button onClick={() => remove(r.id)} disabled={deleting === r.id} className="rounded-md px-2 py-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50">{deleting === r.id ? '删除中…' : '删除'}</button></div></div></article>)}</div>}</section>
    <p className="text-xs leading-5 text-slate-400">训练数据可由当前服务的内存模式或 PostgreSQL 保存，具体以首页状态为准；删除操作会级联移除对应的简历分析与报告。</p>
  </div>;
}
