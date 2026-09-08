'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Section } from '@/app/components/Section';
import { getDemoResume } from '@/lib/demo/sampleResumes';
import type { ResumeAnalysis } from '@/lib/types';

function ResumeClient() {
  const router = useRouter();
  const search = useSearchParams();
  const roleId = search.get('roleId') ?? '';
  const demoKey = search.get('demo');
  const demo = demoKey ? getDemoResume(demoKey) : null;

  const [text, setText] = useState(demo?.text ?? '');
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (demo) setText(demo.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoKey]);

  async function analyze() {
    if (text.trim().length < 50) {
      setMessage('简历文本过短（至少 50 字），请粘贴完整简历内容');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/resume/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId, resumeText: text }),
      });
      const body = await res.json();
      if (body.ok) {
        setAnalysis(body.data as ResumeAnalysis);
      } else {
        setMessage(body.message ?? '分析失败，请重试');
      }
    } catch {
      setMessage('网络异常，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function uploadPdf(file: File) {
    setUploading(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('roleId', roleId);
      form.append('file', file);
      const res = await fetch('/api/resume/analyze', { method: 'POST', body: form });
      const body = await res.json();
      if (body.ok) {
        setAnalysis(body.data as ResumeAnalysis);
      } else {
        setMessage(body.message ?? 'PDF 解析失败，请直接粘贴简历文本');
      }
    } catch {
      setMessage('上传失败，请直接粘贴简历文本');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function startInterview() {
    if (!analysis) return;
    setStarting(true);
    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId, resumeAnalysisId: analysis.id }),
      });
      const body = await res.json();
      if (body.ok) {
        router.push(`/interview?sessionId=${body.data.id}`);
      } else {
        setMessage(body.message ?? '开始面试失败');
        setStarting(false);
      }
    } catch {
      setMessage('网络异常，请重试');
      setStarting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">第一步：简历输入与分析</h1>
        <p className="mt-1 text-sm text-slate-500">
          粘贴简历文本（推荐，成功率最高）或上传文本型 PDF；系统将对照岗位要求给出结构化缺口分析。
        </p>
      </div>

      {demo ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          已载入{demo.label}。{demo.note}
        </div>
      ) : null}

      <Section title="输入简历">
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="把简历全文粘贴到这里：教育经历、技能、项目经历、成果……"
            className="w-full rounded-md border border-slate-300 p-3 font-mono text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              onClick={analyze}
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '分析中…' : '分析简历'}
            </button>
            <span className="text-slate-400">或</span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPdf(f);
              }}
              className="text-sm text-slate-600"
            />
            {uploading ? <span className="text-xs text-slate-500">PDF 解析中…</span> : null}
          </div>
          {message ? <p className="text-sm text-red-600">{message}</p> : null}
        </div>
      </Section>

      {analysis ? (
        <>
          <Section
            title="分析结果"
            hint={
              analysis.source === 'llm'
                ? '分析来源：大模型（结构化校验通过）'
                : '分析来源：规则兜底（未配置大模型或模型输出未通过校验）'
            }
          >
            <div className="space-y-5 text-sm">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold text-blue-600">{analysis.matchingScore}</div>
                <div>
                  <p className="font-medium text-slate-700">岗位匹配分（0-100）</p>
                  <p className="text-xs text-slate-500">基于简历证据与岗位要求的规则化匹配度，非录取概率</p>
                </div>
              </div>

              {analysis.matchedSkills.length ? (
                <div>
                  <p className="mb-1 font-medium text-slate-700">已具备的技能</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.matchedSkills.map((s) => (
                      <Badge key={s} tone="green">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {analysis.gaps.length ? (
                <div>
                  <p className="mb-2 font-medium text-slate-700">岗位缺口（{analysis.gaps.length}）</p>
                  <div className="space-y-2">
                    {analysis.gaps.map((g, i) => (
                      <div key={i} className="rounded border border-slate-200 p-3">
                        <p className="font-medium text-slate-700">岗位要求：{g.requirement}</p>
                        <p className="mt-1 text-slate-600">简历现状：{g.current || '未找到相关描述'}</p>
                        <p className="mt-1 text-slate-600">问题：{g.problem}</p>
                        <p className="mt-1 text-slate-600">建议：{g.suggestion}</p>
                        {g.evidence ? <p className="mt-1 text-xs text-slate-400">证据：{g.evidence}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {analysis.vagueIssues.length ? (
                <div>
                  <p className="mb-1 font-medium text-slate-700">空泛表述 / 缺少量化</p>
                  <ul className="list-disc space-y-1 pl-5 text-slate-600">
                    {analysis.vagueIssues.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {analysis.suggestions.length ? (
                <div>
                  <p className="mb-1 font-medium text-slate-700">修改建议（按优先级）</p>
                  <ol className="space-y-1.5">
                    {analysis.suggestions.map((s) => (
                      <li key={s.priority} className="rounded bg-slate-50 p-3">
                        <span className="mr-1 font-semibold text-blue-600">P{s.priority}</span>
                        <span className="font-medium text-slate-700">{s.title}</span>
                        <p className="mt-0.5 text-slate-600">{s.detail}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </Section>

          <div className="flex justify-end">
            <button
              onClick={startInterview}
              disabled={starting}
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {starting ? '准备面试中…' : '用这份简历开始模拟面试 →'}
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          分析完成后会在这里展示结构化结果。也可以返回
          <Link href="/" className="mx-1 text-blue-600 hover:underline">
            首页
          </Link>
          使用演示简历。
        </p>
      )}
    </div>
  );
}

export default function ResumePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">加载中…</p>}>
      <ResumeClient />
    </Suspense>
  );
}
