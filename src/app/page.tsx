'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Section } from '@/app/components/Section';
import type { RoleTarget } from '@/lib/types';

const FLOW_STEPS = [
  ['01', '准备材料', '上传简历或粘贴真实 JD'],
  ['02', '岗位匹配', 'AI 解析能力与岗位要求'],
  ['03', '模拟面试', '针对岗位生成问题与追问'],
  ['04', '复盘提升', '证据评分与二次挑战'],
];

interface Health {
  mode: 'llm' | 'fallback';
  llmModel: string | null;
  store: 'memory' | 'postgres';
  asrConfigured: boolean;
}

export default function HomePage() {
  const [roles, setRoles] = useState<RoleTarget[]>([]);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/roles')
      .then((r) => r.json())
      .then((b) => {
        if (b.ok) setRoles(b.data as RoleTarget[]);
      })
      .catch(() => undefined);
    fetch('/api/health')
      .then((r) => r.json())
      .then((b) => {
        if (b.ok) setHealth(b.data as Health);
      })
      .catch(() => undefined);
  }, []);

  const roleId = roles[0]?.id ?? '';

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-[#24404c] bg-[#172033] text-white shadow-[0_14px_36px_rgba(23,32,51,0.16)]">
        <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.3fr_0.7fr] md:px-9 md:py-10">
          <div>
            <p className="cf-eyebrow text-[#78d2c8]">CAREER TRAINING WORKSPACE</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">把每一次面试，变成下一次进步的证据。</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              从简历解析、岗位匹配到模拟面试和复盘建议，CareerForge 帮你围绕真实求职目标持续训练，而不是只练习一套固定题目。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/resume?roleId=${roleId}`} className="cf-button-primary px-5 py-2.5 text-sm font-semibold">
                开始一次训练 <span className="ml-1">→</span>
              </Link>
              <Link href={`/resume?roleId=${roleId}&demo=basic`} className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10">
                查看演示案例
              </Link>
            </div>
          </div>
          <div className="flex flex-col justify-end rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Workspace status</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-white/10 pb-3"><span className="text-slate-400">职业方向</span><span className="font-semibold">{roles.length || '—'} 个可选</span></div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3"><span className="text-slate-400">AI 引擎</span><span className="font-semibold text-[#8be0d6]">{health?.mode === 'llm' ? health.llmModel : '规则兜底'}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">训练记录</span><span className="font-semibold">可追踪复盘</span></div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/10 px-6 py-3 text-xs md:px-9">
          {health ? (
            health.mode === 'llm' ? (
              <Badge tone="green">在线模式 · {health.llmModel}</Badge>
            ) : (
              <Badge tone="amber">兜底模式 · 固定题库 + 规则评分</Badge>
            )
          ) : null}
          <span className="text-slate-400">数据存储：{health?.store === 'postgres' ? 'PostgreSQL' : '内存'}</span>
        </div>
      </section>

      <Section title="训练路径" hint="一次训练包含四个阶段，所有建议都围绕你选择的岗位生成">
        <ol className="grid gap-3 md:grid-cols-4">
          {FLOW_STEPS.map(([number, title, detail], i) => (
            <li key={number} className="relative rounded-lg border border-slate-200 bg-[#f8fbfc] p-4">
              <span className="text-xs font-bold tracking-[0.12em] text-[#2b9b94]">{number}</span>
              <p className="mt-3 font-semibold text-slate-800">{title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              {i < FLOW_STEPS.length - 1 ? <span className="absolute -right-2 top-1/2 z-10 hidden text-slate-300 md:block">→</span> : null}
            </li>
          ))}
        </ol>
      </Section>

      {roles.length ? (
        <Section title="职业方向库" hint="从软件工程、AI/Agent、数据、基础设施和安全方向中选择训练目标">
          <div className="grid gap-3 md:grid-cols-2">
            {roles.map((role) => (
              <div key={role.id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-700">{role.name}</p>
                <p className="mt-1 text-xs text-slate-500">{role.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {role.requirements.requiredSkills.slice(0, 4).map((s) => <Badge key={s.label} tone="blue">{s.label}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <p className="text-sm text-slate-500">正在加载岗位配置…</p>
      )}
    </div>
  );
}
