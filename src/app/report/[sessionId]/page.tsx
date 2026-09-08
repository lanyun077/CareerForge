'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Section } from '@/app/components/Section';
import { ScoreBar } from '@/app/components/ScoreBar';
import type { ReviewReport } from '@/lib/types';

export default function ReportPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? '';
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/report/${sessionId}`)
      .then((r) => r.json())
      .then((b) => {
        if (b.ok) setReport(b.data as ReviewReport);
        else setError(b.message ?? '报告生成失败');
      })
      .catch(() => setError('网络异常，请刷新重试'));
  }, [sessionId]);

  async function startRound2() {
    if (!report) return;
    setStarting(true);
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: report.roleId,
          round: 2,
          basedOnSessionId: report.sessionId,
        }),
      });
      const body = await res.json();
      if (body.ok) {
        window.location.href = `/interview?sessionId=${body.data.id}`;
        return;
      }
      setError(body.message ?? '开始专项挑战失败');
    } catch {
      setError('网络异常，请重试');
    }
    setStarting(false);
  }

  if (error && !report) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/records" className="text-sm text-blue-600 hover:underline">
          查看训练记录
        </Link>
      </div>
    );
  }
  if (!report) return <p className="text-sm text-slate-500">正在生成复盘报告…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">复盘报告 · 第 {report.round} 轮训练</h1>
          <p className="mt-1 text-sm text-slate-500">
            {report.roleName}（模拟岗位）· 报告来源：
            {report.source === 'llm' ? '大模型文案 + 固定公式评分' : '规则模板 + 固定公式评分'}
          </p>
        </div>
        <Badge tone="slate">分数为模拟表现分，非录取概率</Badge>
      </div>

      <Section title="模拟表现分与岗位准备度">
        <div className="flex items-center gap-6">
          <div className="text-5xl font-bold text-blue-600">{report.overallScore}</div>
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-700">满分 100</p>
            <p className="mt-1">{report.jobReadiness}</p>
          </div>
        </div>
      </Section>

      <Section title="各维度评分" hint="分数由后端固定公式计算；证据来自你的回答原文">
        <div className="space-y-4">
          {report.dimensionScores.map((d) => (
            <div key={d.id} className="rounded border border-slate-200 p-3">
              <ScoreBar name={d.name} score={d.score} maxScore={d.maxScore} weight={d.weight} />
              <p className="mt-2 text-xs text-slate-500">证据：{d.evidence}</p>
              <p className="mt-1 text-xs text-slate-600">建议：{d.suggestion}</p>
              <div className="mt-1.5">
                <Badge tone={d.source === 'llm' ? 'blue' : 'slate'}>
                  {d.source === 'llm' ? '模型评分' : '规则评分'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="主要失分原因">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            {report.mainIssues.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
        <Section title="回答证据片段">
          <ul className="space-y-2 text-sm text-slate-600">
            {report.evidence.map((s, i) => (
              <li key={i} className="border-l-2 border-slate-200 pl-3">
                {s}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="下一轮训练建议">
        <ul className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          {report.nextStepSuggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>

      <Section title="推荐的专项挑战" hint="第二场面试将围绕薄弱维度重新出题，而不是重复同一套题">
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-700">聚焦维度：</span>
            {report.nextChallenge.focusAreas.join('、')}
          </p>
          <p>{report.nextChallenge.description}</p>
          {report.nextChallenge.recommendedQuestions.length ? (
            <ul className="list-disc pl-5">
              {report.nextChallenge.recommendedQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </Section>

      {report.comparison ? (
        <Section title="两次训练对比" hint="与首轮训练的各维度变化">
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-slate-400">首轮模拟表现分</p>
                <p className="text-2xl font-bold text-slate-600">{report.comparison.baseOverallScore}</p>
              </div>
              <div className="text-slate-400">→</div>
              <div>
                <p className="text-xs text-slate-400">本轮模拟表现分</p>
                <p className="text-2xl font-bold text-blue-600">{report.comparison.currentOverallScore}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">变化</p>
                <p
                  className={`text-2xl font-bold ${
                    report.comparison.currentOverallScore >= report.comparison.baseOverallScore
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {report.comparison.currentOverallScore - report.comparison.baseOverallScore >= 0 ? '+' : ''}
                  {Math.round((report.comparison.currentOverallScore - report.comparison.baseOverallScore) * 10) / 10}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="py-1.5">维度</th>
                    <th className="py-1.5">首轮</th>
                    <th className="py-1.5">本轮</th>
                    <th className="py-1.5">变化</th>
                  </tr>
                </thead>
                <tbody>
                  {report.comparison.dimensionDeltas.map((d) => (
                    <tr key={d.name} className="border-t border-slate-100">
                      <td className="py-1.5 font-medium text-slate-700">{d.name}</td>
                      <td className="py-1.5 tabular-nums text-slate-500">{d.before}</td>
                      <td className="py-1.5 tabular-nums text-slate-700">{d.after}</td>
                      <td
                        className={`py-1.5 tabular-nums font-medium ${
                          d.delta > 0 ? 'text-green-600' : d.delta < 0 ? 'text-red-600' : 'text-slate-400'
                        }`}
                      >
                        {d.delta > 0 ? '▲ +' : d.delta < 0 ? '▼ ' : ''}
                        {d.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.comparison.improved.length ? (
              <p className="text-green-700">已改善：{report.comparison.improved.join('、')}</p>
            ) : null}
            {report.comparison.remaining.length ? (
              <p className="text-amber-700">仍需改进：{report.comparison.remaining.join('、')}</p>
            ) : null}
          </div>
        </Section>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        {report.round === 1 ? (
          <button
            onClick={startRound2}
            disabled={starting}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? '准备中…' : '开始第二次专项挑战 →'}
          </button>
        ) : report.comparison ? (
          <Link
            href={`/report/${report.comparison.baseSessionId}`}
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            查看首轮报告
          </Link>
        ) : null}
        <Link
          href="/records"
          className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          训练记录
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
