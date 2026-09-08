'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge, Section } from '@/app/components/Section';
import type { InterviewSession } from '@/lib/types';

function InterviewClient() {
  const search = useSearchParams();
  const sessionId = search.get('sessionId') ?? '';
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('缺少会话参数，请从简历分析页重新开始');
      return;
    }
    fetch(`/api/interview/session/${sessionId}`)
      .then((r) => r.json())
      .then((b) => {
        if (b.ok) setSession(b.data as InterviewSession);
        else setError(b.message ?? '会话不存在');
      })
      .catch(() => setError('网络异常，请刷新重试'));
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.questions.length, session?.status]);

  const submit = useCallback(async () => {
    if (!session || !answer.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, answer }),
      });
      const body = await res.json();
      if (body.ok) {
        setSession(body.data.session as InterviewSession);
        setAnswer('');
      } else {
        setError(body.message ?? '提交失败，请重试');
      }
    } catch {
      setError('网络异常，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [session, answer, submitting]);

  if (error && !session) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          返回首页
        </Link>
      </div>
    );
  }
  if (!session) return <p className="text-sm text-slate-500">加载面试会话…</p>;

  const answered = session.questions.filter((q) => q.answer !== undefined).length;
  const last = session.questions[session.questions.length - 1];
  const pending: 'question' | 'followUp' | null =
    last === undefined
      ? null
      : last.answer === undefined
        ? 'question'
        : last.followUps.length && last.followUps[last.followUps.length - 1].answer === undefined
          ? 'followUp'
          : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">
            第 {session.round} 轮 · 文字模拟面试
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {session.roleName} · 进度 {Math.min(answered + (session.status === 'active' ? 1 : 0), session.plan.length)} / {session.plan.length} 题 · 每题最多追问 1 次
          </p>
        </div>
        {session.round === 2 ? <Badge tone="blue">专项挑战：{(session.focusWeaknesses ?? []).join('、')}</Badge> : null}
      </div>

      <div className="space-y-3">
        {session.questions.map((q, qi) => (
          <div key={q.id} className="space-y-2">
            <div className="rounded-lg border-l-4 border-blue-500 bg-white p-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                <span>
                  第 {qi + 1} 题 · {q.stageName}
                </span>
                <Badge tone={q.source === 'llm' ? 'blue' : 'slate'}>
                  {q.source === 'llm' ? '模型生成' : '题库'}
                </Badge>
              </div>
              <p className="text-sm text-slate-800">{q.text}</p>
            </div>

            {q.answer ? (
              <div className="ml-8 rounded-lg bg-blue-50 p-3 text-sm text-slate-700">
                <p className="mb-1 text-xs text-slate-400">你的回答</p>
                {q.answer}
              </div>
            ) : null}

            {q.followUps.map((fu) => (
              <div key={fu.id} className="rounded-lg border-l-4 border-amber-400 bg-white p-4">
                <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                  <Badge tone="amber">追问</Badge>
                  <span>追问依据：{fu.reason}</span>
                  <Badge tone={fu.source === 'llm' ? 'blue' : 'slate'}>
                    {fu.source === 'llm' ? '模型生成' : '规则兜底'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-800">{fu.text}</p>
              </div>
            ))}

            {q.followUps
              .filter((fu) => fu.answer)
              .map((fu) => (
                <div key={`${fu.id}-a`} className="ml-8 rounded-lg bg-blue-50 p-3 text-sm text-slate-700">
                  <p className="mb-1 text-xs text-slate-400">你的追问回答</p>
                  {fu.answer}
                </div>
              ))}
          </div>
        ))}
      </div>

      {session.status === 'active' && pending && last ? (
        <Section title={pending === 'question' ? '请回答当前问题' : '面试官正在追问'}>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="用文字回答（建议：先给结论，再讲背景-任务-行动-结果，尽量带数据）"
            className="w-full rounded-md border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">提示：回答包含具体模块、方法和量化结果，评分更高</p>
            <button
              onClick={submit}
              disabled={submitting || !answer.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? '提交中…' : '提交回答'}
            </button>
          </div>
        </Section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {session.status === 'completed' ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-center">
          <p className="text-sm text-green-800">{session.closingMessage ?? '本次训练已结束。'}</p>
          <Link
            href={`/report/${session.id}`}
            className="mt-3 inline-block rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
          >
            生成复盘报告 →
          </Link>
        </div>
      ) : null}

      <div ref={bottomRef} />
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">加载中…</p>}>
      <InterviewClient />
    </Suspense>
  );
}
