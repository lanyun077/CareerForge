'use client';

import { VoiceAnswer } from '@/app/components/VoiceAnswer';
import { useAuthRecovery } from '@/app/components/useAuthRecovery';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/app/components/Section';
import type { InterviewSession } from '@/lib/types';

function InterviewClient() {
  const { request, recovery, retryVersion } = useAuthRecovery();
  const search = useSearchParams();
  const sessionId = search.get('sessionId') ?? '';
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);
  const submittingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) { setError('缺少会话参数，请从简历分析页重新开始'); return; }
    request(`/api/interview/session/${sessionId}`)
      .then((r) => r.json())
      .then((b) => {
        if (b.ok) { setSession(b.data as InterviewSession); setStale(false); setError(retryVersion ? '已恢复训练，输入已保留，请核对当前问题后提交。' : ''); }
        else setError(b.message ?? '会话不存在');
      })
      .catch(() => setError('网络异常，请刷新重试'));
  }, [sessionId, request, retryVersion]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [session?.questions.length, session?.status]);

  const submit = useCallback(async () => {
    if (!session || !answer.trim() || submittingRef.current || stale) return;
    const question = session.questions[session.questions.length - 1];
    const questionId = question.answer === undefined ? question.id : question.followUps.find((fu) => fu.answer === undefined)?.id;
    if (!questionId) return;
    submittingRef.current = true;
    setSubmitting(true); setError('');
    try {
      const res = await request('/api/interview/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: session.id, questionId, answer }) });
      const body = await res.json();
      if (body.ok) { setSession(body.data.session as InterviewSession); setAnswer(''); }
      else { setError(body.message ?? '提交失败，请重试'); if (res.status === 409) setStale(true); }
    } catch { setError('网络异常，输入已保留，请重试'); } finally { submittingRef.current = false; setSubmitting(false); }
  }, [session, answer, stale, request]);

  const reloadSession = async () => {
    try {
      const res = await request(`/api/interview/session/${sessionId}`);
      const body = await res.json();
      if (!body.ok) { setError(body.message ?? '会话不可用，请返回训练记录'); return; }
      setSession(body.data as InterviewSession);
      setStale(false);
      setError('已加载最新训练状态。旧输入已保留，请核对当前问题并修改后再提交。');
    } catch { setError('加载失败，输入已保留，请重试'); }
  };

  if (error && !session) return <div className="cf-empty">{recovery}<button onClick={reloadSession} className="underline">重新加载</button><p className="text-sm text-rose-700">{error}</p><Link href="/" className="cf-button-secondary mt-4 inline-block px-4 py-2 text-sm">返回首页</Link></div>;
  if (!session) return <div className="cf-loading">正在加载面试工作区…</div>;

  const answered = session.currentPlanIndex;
  const last = session.questions[session.questions.length - 1];
  const pending: 'question' | 'followUp' | null = last === undefined ? null : last.answer === undefined ? 'question' : last.followUps.length && last.followUps[last.followUps.length - 1].answer === undefined ? 'followUp' : null;
  const progress = Math.round((answered / Math.max(1, session.plan.length)) * 100);
  const activeStage = session.plan[Math.min(answered, session.plan.length - 1)]?.stageName ?? '总结';

  return <div className="space-y-5">
    <section className="cf-hero-panel">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="cf-eyebrow text-[#8be0d6]">INTERVIEW WORKSPACE / ROUND {session.round}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">{session.roleName}</h1><p className="mt-2 text-sm text-slate-300">{session.round === 2 ? '专项挑战 · ' : '岗位模拟面试 · '}当前阶段：{activeStage}</p></div>
        <div className="flex items-center gap-2">{session.round === 2 ? <Badge tone="blue">聚焦 {(session.focusWeaknesses ?? []).join('、')}</Badge> : <Badge tone="green">首轮训练</Badge>}<Link href="/records" className="rounded-md border border-white/20 px-3 py-2 text-xs text-slate-200 hover:bg-white/10">退出训练</Link></div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end"><div><div className="mb-2 flex items-center justify-between text-xs text-slate-400"><span>训练进度</span><span className="tabular-nums text-white">{answered} / {session.plan.length} 题</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#64c7bd] transition-all" style={{ width: `${Math.max(5, progress)}%` }} /></div></div><div className="text-left md:text-right"><p className="text-3xl font-bold text-[#8be0d6]">{progress}%</p><p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">completed</p></div></div>
    </section>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <section className="space-y-3"><div className="flex items-center justify-between px-1"><div><p className="cf-eyebrow">LIVE TRANSCRIPT</p><h2 className="mt-1 text-base font-semibold text-slate-800">面试记录</h2></div><span className="text-xs text-slate-400">{session.settings?.difficulty === 'advanced' ? '进阶' : session.settings?.difficulty === 'basic' ? '基础' : '标准'} · 每题最多追问 {session.settings?.maxFollowUps ?? 1} 次</span></div>
        {session.questions.map((q, qi) => <article key={q.id} className={`cf-transcript-item ${q.answer === undefined ? 'is-current' : ''}`}><div className="flex gap-3"><div className="cf-step-dot">{String(qi + 1).padStart(2, '0')}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>{q.stageName}</span><Badge tone={q.source === 'llm' ? 'blue' : 'slate'}>{q.source === 'llm' ? 'AI 提问' : '题库提问'}</Badge>{q.answer !== undefined ? <span className="text-emerald-600">已回答</span> : <span className="text-[#176b67]">当前问题</span>}</div><p className="mt-2 text-sm font-medium leading-6 text-slate-800">{q.text}</p>{q.answer ? <div className="mt-3 rounded-lg bg-[#eef8f7] p-3 text-sm leading-6 text-slate-700"><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#398c86]">你的回答</p>{q.answer}</div> : null}{q.followUps.map((fu) => <div key={fu.id} className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3"><div className="flex flex-wrap items-center gap-2 text-xs text-amber-700"><Badge tone="amber">追问</Badge><span>{fu.reason}</span></div><p className="mt-2 text-sm leading-6 text-slate-800">{fu.text}</p>{fu.answer ? <div className="mt-2 rounded bg-white/70 p-2.5 text-sm leading-6 text-slate-700"><span className="mr-1 text-xs text-slate-400">你的回答：</span>{fu.answer}</div> : null}</div>)}</div></div></article>)}
        <div ref={bottomRef} />
      </section>

      <aside className="space-y-4 lg:sticky lg:top-5">
        {session.status === 'active' && pending && last ? <section className="cf-answer-panel"><div className="flex items-center justify-between"><div><p className="cf-eyebrow">YOUR TURN</p><h2 className="mt-1 text-base font-semibold text-slate-900">{pending === 'question' ? '回答当前问题' : '回应面试官追问'}</h2></div><span className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500">{answer.length} / 5000 字</span></div><textarea aria-label="当前问题回答" maxLength={5000} disabled={submitting} value={answer} onChange={(e) => setAnswer(e.target.value)} rows={9} placeholder="先给结论，再说明背景、任务、行动和结果。尽量带上模块、方法和数据。" className="cf-input mt-4 min-h-48 w-full resize-y bg-white p-3 text-sm leading-6" /><VoiceAnswer key={`${retryVersion}:${pending === 'followUp' ? last.followUps.at(-1)?.id : last.id}`} disabled={submitting || stale} request={request} onUse={(text) => { if ((answer + '\n' + text).trim().length > 5000) { setError('合并后超过 5000 字，请先缩短回答或转写内容。'); return false; } setAnswer((current) => (current + '\n' + text).trim()); return true; }} /><div className="mt-3 flex items-center justify-between gap-3"><p className="text-[11px] leading-5 text-slate-500">具体职责 + 技术方法 + 可验证结果，会让回答更有说服力。</p><button onClick={submit} disabled={submitting || stale || !answer.trim()} className="cf-button-primary shrink-0 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{submitting ? '提交中…' : '提交回答 →'}</button></div></section> : null}
        {recovery}{error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}{stale ? <button onClick={reloadSession} className="mt-2 block underline">加载最新问题（保留输入）</button> : null}</div> : null}
        {session.status === 'completed' ? <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><p className="cf-eyebrow text-emerald-700">SESSION COMPLETE</p><h2 className="mt-1 text-lg font-semibold text-emerald-900">本轮训练已完成</h2><p className="mt-2 text-sm leading-6 text-emerald-800">{session.closingMessage ?? '现在可以查看基于回答证据生成的复盘报告。'}</p><Link href={`/report/${session.id}`} className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">查看复盘报告 →</Link></section> : null}
        <section className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">本轮结构</p><div className="mt-3 space-y-2">{session.plan.map((item, i) => <div key={`${item.stageId}-${i}`} className="flex items-center gap-2 text-xs"><span className={`h-2 w-2 rounded-full ${i < answered ? 'bg-emerald-500' : i === answered ? 'bg-[#2b9b94]' : 'bg-slate-200'}`} /><span className={i <= answered ? 'font-medium text-slate-700' : 'text-slate-400'}>{item.stageName}</span></div>)}</div></section>
      </aside>
    </div>
  </div>;
}

export default function InterviewPage() {
  return <Suspense fallback={<div className="cf-loading">加载中…</div>}><InterviewClient /></Suspense>;
}
