'use client';

import { useAuthRecovery } from '@/app/components/useAuthRecovery';
import { JobSource } from '@/app/components/JobSource';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge } from '@/app/components/Section';
import { ScoreBar } from '@/app/components/ScoreBar';
import type { ReviewReport } from '@/lib/types';

export default function ReportPage() {
  const { request, recovery, retryVersion } = useAuthRecovery();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? '';
  const [report, setReport] = useState<ReviewReport | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setError('');
    request(`/api/report/${sessionId}`).then((r) => r.json()).then((b) => b.ok ? setReport(b.data as ReviewReport) : setError(b.message ?? '报告生成失败')).catch(() => setError('网络异常，请刷新重试'));
  }, [sessionId, request, retryVersion]);

  async function startRound2() {
    if (!report || starting) return;
    setStarting(true); setError('');
    try {
      const res = await request('/api/interview/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId: report.roleId, round: 2, basedOnSessionId: report.sessionId }) });
      const body = await res.json();
      if (body.ok) { window.location.href = `/interview?sessionId=${body.data.id}`; return; }
      setError(body.message ?? '开始专项挑战失败');
    } catch { setError('网络异常，请重试'); } finally { setStarting(false); }
  }

  if (error && !report) return <div className="cf-empty">{recovery}<p className="text-sm text-rose-700">{error}</p><Link href="/records" className="cf-button-secondary mt-4 inline-block px-4 py-2 text-sm">查看训练记录</Link></div>;
  if (!report) return <div className="cf-loading">正在整理回答证据与复盘报告…</div>;

  const weakest = report.dimensionScores.slice().sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)[0];
  const delta = report.comparison ? Math.round((report.comparison.currentOverallScore - report.comparison.baseOverallScore) * 10) / 10 : null;

  return <div className="report-print space-y-5">{recovery}<button onClick={() => window.print()} className="cf-button-secondary px-4 py-2 text-sm">打印 / 保存 PDF</button>
    <section className="cf-hero-panel"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="cf-eyebrow text-[#8be0d6]">REVIEW DESK / ROUND {report.round}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">{report.roleName}</h1><p className="mt-2 text-sm text-slate-300">训练复盘 · {report.source === 'llm' ? 'AI 文案 + 固定公式评分' : '规则模板 + 固定公式评分'}</p></div><Badge tone="green">模拟表现分 · 非录取概率</Badge></div><div className="mt-7 grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center"><div><p className="text-6xl font-bold leading-none text-[#8be0d6]">{report.overallScore}</p><p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">score / 100</p></div><div className="max-w-xl"><p className="text-sm leading-7 text-slate-200">{report.jobReadiness}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#64c7bd]" style={{ width: `${report.overallScore}%` }} /></div></div><div className="rounded-lg border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-400">当前最需要关注</p><p className="mt-1 font-semibold text-white">{weakest.name}</p><p className="mt-1 text-xs text-slate-400">{weakest.score} / {weakest.maxScore}</p></div></div></section>

    {report.jobProvenance ? <section className="cf-section p-5 md:p-6"><h2 className="mb-3 text-base font-semibold text-slate-800">本轮岗位来源</h2><JobSource provenance={report.jobProvenance} /></section> : null}

    <section className="cf-section p-5 md:p-6"><h2 className="text-base font-semibold text-slate-800">简历与岗位匹配</h2>{report.resumeSummary ? <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600"><p>当次简历匹配分：<strong>{report.resumeSummary.matchingScore} / 100</strong> · {report.resumeSummary.source === 'llm' ? '模型辅助分析' : '规则分析'}</p><p>此分数来自训练开始时的简历分析，不计入面试表现分，不代表录取概率。</p><p>已匹配技能：{report.resumeSummary.matchedSkills.join('、') || '未记录匹配技能'}</p><h3 className="font-medium text-slate-800">待补齐的技能或证据</h3>{report.resumeSummary.gaps.length ? <ul className="space-y-3">{report.resumeSummary.gaps.map((gap, i) => <li key={i} className="border-l-2 border-amber-300 pl-3"><p className="font-medium">{gap.requirement}</p><p>{gap.problem}</p>{gap.evidence ? <p>简历证据：{gap.evidence}</p> : null}<p>行动：{gap.suggestion}</p></li>)}</ul> : <p>本次分析未记录缺口；不代表所有岗位要求均已验证。</p>}</div> : <p className="mt-3 text-sm text-slate-500">旧报告未保存简历匹配摘要。</p>}</section>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"><main className="space-y-5"><section className="cf-section p-5 md:p-6"><div className="flex items-end justify-between"><div><p className="cf-eyebrow">DIMENSION SCORECARD</p><h2 className="mt-1 text-base font-semibold text-slate-800">能力维度</h2></div><span className="text-xs text-slate-400">固定权重 · 回答证据</span></div><div className="mt-5 grid gap-3 md:grid-cols-2">{report.dimensionScores.map((d) => <div key={d.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"><ScoreBar name={d.name} score={d.score} maxScore={d.maxScore} weight={d.weight} /><p className="mt-3 text-xs leading-5 text-slate-600">{d.evidenceQuestion ? <>问题：{d.evidenceQuestion}<br /></> : null}<span className="font-semibold text-slate-700">证据：</span>{d.evidence}</p><p className="mt-2 text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">下一步：</span>{d.suggestion}</p><div className="mt-3"><Badge tone={d.source === 'llm' ? 'blue' : 'slate'}>{d.scoringSources?.length === 2 ? '模型与规则混合评分' : d.source === 'llm' ? '模型评分' : '规则评分'}</Badge></div></div>)}</div></section>
      <div className="grid gap-5 md:grid-cols-2"><section className="cf-section p-5"><p className="cf-eyebrow">SIGNALS</p><h2 className="mt-1 text-base font-semibold text-slate-800">主要失分原因</h2><ul className="mt-4 space-y-3">{report.mainIssues.map((s, i) => <li key={i} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-50 text-xs font-semibold text-rose-600">{i + 1}</span><span>{s}</span></li>)}</ul></section><section className="cf-section p-5"><p className="cf-eyebrow">EVIDENCE LOG</p><h2 className="mt-1 text-base font-semibold text-slate-800">回答证据</h2><ul className="mt-4 space-y-3">{report.evidence.map((s, i) => <li key={i} className="border-l-2 border-[#64c7bd] pl-3 text-sm leading-6 text-slate-600">{s}</li>)}</ul></section></div>
      <section className="cf-section p-5 md:p-6"><p className="cf-eyebrow">NEXT ACTIONS</p><h2 className="mt-1 text-base font-semibold text-slate-800">下一轮训练建议</h2><ol className="mt-4 grid gap-3 md:grid-cols-3">{report.nextStepSuggestions.map((s, i) => <li key={i} className="rounded-lg border border-slate-200 p-4"><span className="text-xs font-bold text-[#2b9b94]">0{i + 1}</span><p className="mt-2 text-sm leading-6 text-slate-600">{s}</p></li>)}</ol></section>
    </main><aside className="space-y-5 lg:sticky lg:top-5"><section className="rounded-xl border border-[#c8e7e3] bg-[#eef8f7] p-5"><p className="cf-eyebrow">FOCUS CHALLENGE</p><h2 className="mt-1 text-lg font-semibold text-[#124a47]">{report.nextChallenge.focusAreas.join(' · ')}</h2><p className="mt-3 text-sm leading-6 text-slate-600">{report.nextChallenge.description}</p>{report.nextChallenge.recommendedQuestions.length ? <div className="mt-4 space-y-2">{report.nextChallenge.recommendedQuestions.map((q, i) => <div key={i} className="rounded-md bg-white/70 p-2.5 text-xs leading-5 text-slate-600">{q}</div>)}</div> : null}<button onClick={startRound2} disabled={starting || report.round !== 1} className="mt-5 w-full rounded-md bg-[#176b67] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#115854] disabled:cursor-not-allowed disabled:opacity-50">{report.round === 1 ? (starting ? '准备中…' : '开始专项挑战 →') : '已完成第二轮挑战'}</button></section>
      {report.comparison ? <section className="cf-section p-5"><p className="cf-eyebrow">PROGRESS DELTA</p><h2 className="mt-1 text-base font-semibold text-slate-800">两轮训练变化</h2><p className="mt-2 text-xs leading-5 text-slate-500">题目和评分来源可能不同，分数变化只反映这两次模拟表现，不等同于能力提升幅度。</p><div className="mt-3 space-y-2 text-sm leading-6 text-slate-600"><p>本次得分上升项：{report.comparison.improved.join('、') || '暂无维度达到上升阈值'}</p><p className="text-xs text-slate-500">按维度分增加至少 0.3 分标记，不表示问题已经解决。</p><p>仍需补强：{report.comparison.remaining.join('、') || '暂无维度低于满分的 60%，仍需结合回答证据复核'}</p></div><div className="mt-4 flex items-end justify-between"><div><p className="text-xs text-slate-400">首轮 → 本轮</p><p className="mt-1 text-2xl font-bold text-slate-700">{report.comparison.baseOverallScore} <span className="text-slate-300">→</span> {report.comparison.currentOverallScore}</p></div><p className={`text-2xl font-bold ${delta !== null && delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{delta !== null && delta >= 0 ? '+' : ''}{delta}</p></div><div className="mt-5 space-y-3">{report.comparison.dimensionDeltas.map((d) => <div key={d.name}><p className="text-xs leading-5 text-slate-500">首轮证据：{d.beforeEvidence ?? '旧报告未记录'}<br />本轮证据：{d.afterEvidence ?? '未记录'}<br />评分来源：{d.beforeSources?.map((s) => s === 'llm' ? '模型' : '规则').join(' / ') ?? '旧报告未记录'} → {d.afterSources?.map((s) => s === 'llm' ? '模型' : '规则').join(' / ') ?? '未记录'}</p><div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{d.name}</span><span className={d.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{d.delta >= 0 ? '+' : ''}{d.delta}</span></div><div className="h-1.5 rounded-full bg-slate-100"><div className={`h-full rounded-full ${d.delta >= 0 ? 'bg-emerald-500' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, Math.max(8, 50 + d.delta * 15))}%` }} /></div></div>)}</div></section> : null}</aside></div>
    {error ? <p className="text-sm text-rose-700">{error}</p> : null}<div className="flex flex-wrap justify-between gap-3"><Link href="/records" className="cf-button-secondary px-4 py-2.5 text-sm font-medium">返回训练记录</Link>{report.comparison ? <Link href={`/report/${report.comparison.baseSessionId}`} className="cf-button-secondary px-4 py-2.5 text-sm font-medium">查看首轮报告</Link> : null}</div>
  </div>;
}
