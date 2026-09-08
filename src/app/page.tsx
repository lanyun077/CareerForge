'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Section } from '@/app/components/Section';
import type { Role } from '@/lib/types';

const FLOW_STEPS = [
  '选择目标岗位',
  '输入简历',
  '岗位缺口分析',
  '模拟面试 + 针对性追问',
  '复盘报告（证据评分）',
  '二次专项挑战',
  '两次训练对比',
];

interface Health {
  mode: 'llm' | 'fallback';
  llmModel: string | null;
  store: string;
  asrConfigured: boolean;
}

export default function HomePage() {
  const [role, setRole] = useState<Role | null>(null);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/roles')
      .then((r) => r.json())
      .then((b) => {
        if (b.ok && b.data.length) setRole(b.data[0] as Role);
      })
      .catch(() => undefined);
    fetch('/api/health')
      .then((r) => r.json())
      .then((b) => {
        if (b.ok) setHealth(b.data as Health);
      })
      .catch(() => undefined);
  }, []);

  const roleId = role?.id ?? '';

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">AI求职实训教练</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          面向计算机专业学生的 AI 求职训练与复盘系统：根据目标岗位、你的简历和面试回答组织针对性训练，
          把「表现不好」变成「下一轮可以执行的改进建议」，并验证改进效果。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {health ? (
            health.mode === 'llm' ? (
              <Badge tone="green">在线模式 · 大模型已配置（{health.llmModel}）</Badge>
            ) : (
              <Badge tone="amber">兜底模式 · 未配置大模型，使用固定题库 + 规则评分（仍可完整演示）</Badge>
            )
          ) : null}
          <Badge tone="slate">存储：内存（重启清空）</Badge>
          <Badge tone="slate">语音转写：{health?.asrConfigured ? '已配置' : '未配置（文字输入）'}</Badge>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/resume?roleId=${roleId}`}
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            开始训练
          </Link>
          <Link
            href={`/resume?roleId=${roleId}&demo=basic`}
            className="rounded-md border border-blue-600 px-5 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            用演示简历体验（推荐评委）
          </Link>
          <Link
            href="/records"
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            训练记录
          </Link>
        </div>
      </section>

      <Section title="训练闭环" hint="不是一次性问答，而是「训练 → 复盘 → 再挑战 → 对比」的完整循环">
        <ol className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          {FLOW_STEPS.map((s, i) => (
            <li key={s} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="mr-1 font-semibold text-blue-600">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>
      </Section>

      {role ? (
        <Section
          title="岗位配置"
          hint={role.mockNotice}
        >
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-slate-700">{role.name}</p>
              <p className="mt-1 text-slate-500">{role.description}</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-700">必备技能</p>
              <div className="flex flex-wrap gap-1.5">
                {role.requirements.requiredSkills.map((s) => (
                  <Badge key={s.label} tone="blue">
                    {s.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-700">加分技能</p>
              <div className="flex flex-wrap gap-1.5">
                {role.requirements.preferredSkills.map((s) => (
                  <Badge key={s.label}>{s.label}</Badge>
                ))}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              面试阶段：{role.interviewStages.map((s) => s.name).join(' → ')} · 共约{' '}
              {role.interviewStages.reduce((n, s) => n + s.questionCount, 0)} 题，每题最多追问 1 次
            </div>
          </div>
        </Section>
      ) : (
        <p className="text-sm text-slate-500">正在加载岗位配置…</p>
      )}
    </div>
  );
}
