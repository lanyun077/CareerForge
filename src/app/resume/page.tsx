'use client';

import type { InterviewSettings } from '@/lib/types';
import { useAuthRecovery } from '@/app/components/useAuthRecovery';
import { JobSource } from '@/app/components/JobSource';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Section } from '@/app/components/Section';
import { getDemoResume } from '@/lib/demo/sampleResumes';
import type { JobPosting, ResumeAnalysis, RoleProfile, RoleRecommendation, RoleTarget } from '@/lib/types';

function ResumeClient() {
  const { request, recovery, retryVersion } = useAuthRecovery();
  const [settings, setSettings] = useState<InterviewSettings>({ questionCount: 7, difficulty: 'standard', maxFollowUps: 1 });
  const router = useRouter();
  const search = useSearchParams();
  const queryRoleId = search.get('roleId') ?? '';
  const demoKey = search.get('demo');
  const demo = demoKey ? getDemoResume(demoKey) : null;

  const [text, setText] = useState(demo?.text ?? '');
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [roles, setRoles] = useState<RoleTarget[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState(queryRoleId);
  const [recommendations, setRecommendations] = useState<RoleRecommendation[]>([]);
  const [jobText, setJobText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [company, setCompany] = useState('');
  const [collectedSource, setCollectedSource] = useState<JobPosting['provenance']>();
  const [collectionReceipt, setCollectionReceipt] = useState<string>();
  const [collectingJob, setCollectingJob] = useState(false);
  const [jobDraft, setJobDraft] = useState<{ title: string; description: string; responsibilities: string; requiredSkills: string; preferredSkills: string } | null>(null);
  const [roleQuery, setRoleQuery] = useState('');
  const [importingJob, setImportingJob] = useState(false);
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<'analyze' | 'recommend' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const filteredRoles = roles.filter((role) => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return true;
    return [role.name, role.category ?? '', ...(role.aliases ?? []), role.description]
      .join(' ').toLowerCase().includes(q);
  });

  useEffect(() => {
    request('/api/roles')
      .then((r) => r.json())
      .then((b) => {
        if (b.ok) {
          const loaded = b.data as RoleTarget[];
          setRoles(loaded);
          setSelectedRoleId((current) => loaded.some((r) => r.id === current) ? current : loaded.some((r) => r.id === queryRoleId) ? queryRoleId : '');
        }
      })
      .catch(() => undefined);
  }, [queryRoleId, request, retryVersion]);

  useEffect(() => {
    if (demo) setText(demo.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoKey]);

  async function analyze() {
    if (!selectedRoleId) {
      setMessage('请先选择推荐岗位或导入招聘描述');
      return;
    }
    if (text.trim().length < 50) {
      setMessage('简历文本过短（至少 50 字），请粘贴完整简历内容');
      return;
    }
    setOperation('analyze');
    setLoading(true);
    setMessage('');
    try {
      const res = await request('/api/resume/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: selectedRoleId, resumeText: text }),
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

  async function uploadDocument(file: File) {
    setUploading(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await request(file.name.toLowerCase().endsWith('.docx') ? '/api/resume/parse-docx' : '/api/resume/parse-pdf', { method: 'POST', body: form });
      const body = await res.json();
      if (body.ok) {
        setText(body.data.text as string);
        setAnalysis(null);
        setRecommendations([]);
        setMessage(`${body.data.source === 'ocr' ? '已通过 OCR 识别' : '已提取'}“${body.data.fileName ?? file.name}”中的文本，请点击“根据简历推荐岗位”`);
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

  async function recommend() {
    if (text.trim().length < 50) {
      setMessage('简历文本过短（至少 50 字），请粘贴完整简历内容');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await request('/api/roles/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text }),
      });
      const body = await res.json();
      if (body.ok) {
        setRecommendations(body.data as RoleRecommendation[]);
        if (body.data?.[0]?.role?.id) setSelectedRoleId(body.data[0].role.id);
      } else setMessage(body.message ?? '岗位推荐失败，请重试');
    } catch { setMessage('网络异常，请重试'); }
    finally { setLoading(false); }
  }

  async function collectJob() {
    if (!sourceUrl.trim()) { setMessage('请先填写 Greenhouse 公开岗位链接'); return; }
    setCollectingJob(true);
    setMessage('');
    try {
      const res = await request('/api/roles/collect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl.trim() }),
      });
      const body = await res.json();
      if (!body.ok) { setMessage(body.message ?? '采集失败，可直接粘贴招聘描述'); return; }
      setJobText(body.data.jobText);
      setCollectedSource(body.data.provenance);
      setCollectionReceipt(body.data.collectionReceipt);
      setSourceUrl(body.data.provenance.sourceUrl ?? sourceUrl);
      setCompany(body.data.provenance.company ?? '');
      setJobDraft(null);
      setMessage('已获取公开岗位内容，请核对后解析并预览。采集成功不代表仍在招聘。');
    } catch { setMessage('采集失败，可直接粘贴招聘描述'); }
    finally { setCollectingJob(false); }
  }

  async function importJob(confirm = false) {
    if (jobText.trim().length < 30) {
      setMessage('招聘描述过短，请粘贴完整 JD');
      return;
    }
    setImportingJob(true);
    setMessage('');
    try {
      const res = await request('/api/roles/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobText, collectionReceipt, provenance: collectedSource ?? { sourceUrl: sourceUrl.trim() || undefined, company: company.trim() || undefined, method: 'manual' }, preview: !confirm, confirmed: confirm && jobDraft ? { ...jobDraft, responsibilities: jobDraft.responsibilities.split('\n'), requiredSkills: jobDraft.requiredSkills.split('\n'), preferredSkills: jobDraft.preferredSkills.split('\n') } : undefined }),
      });
      const body = await res.json();
      if (body.ok) {
        const role = body.data as JobPosting;
        if (!confirm) {
          setJobDraft({ title: role.name, description: role.description, responsibilities: role.requirements.responsibilities.join('\n'), requiredSkills: role.requirements.requiredSkills.map((s) => s.label).join('\n'), preferredSkills: role.requirements.preferredSkills.map((s) => s.label).join('\n') });
          return;
        }
        setRoles((prev) => [...prev.filter((r) => r.id !== role.id), role]);
        setSelectedRoleId(role.id);
        setRecommendations([]);
        setJobText('');
        setSourceUrl('');
        setCompany('');
        setCollectedSource(undefined);
        setCollectionReceipt(undefined);
        setJobDraft(null);
        setAnalysis(null);
      } else setMessage(body.message ?? '招聘描述解析失败，请重试');
    } catch { setMessage('网络异常，请重试'); }
    finally { setImportingJob(false); }
  }

  async function startInterview() {
    if (!analysis) return;
    setStarting(true);
    try {
      const res = await request('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: analysis.roleId, resumeAnalysisId: analysis.id, settings }),
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

  function chooseRole(id: string) {
    setSelectedRoleId(id);
    setAnalysis(null);
    setMessage('');
  }

  return (
    <fieldset disabled={loading || uploading || importingJob || collectingJob || starting} aria-busy={loading || uploading || importingJob || collectingJob || starting} className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="cf-eyebrow">STEP 01 / MATCHING</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">从简历开始，找到值得练习的岗位。</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          先获取岗位推荐，或粘贴一份真实招聘 JD 导入岗位；选择目标岗位后再进行匹配分析。
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-[#2b9b94]" /> 简历
          <span className="mx-1 text-slate-300">→</span>
          <span>岗位</span>
          <span className="mx-1 text-slate-300">→</span>
          <span>面试</span>
        </div>
      </div>

      {demo ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          已载入{demo.label}。{demo.note}
        </div>
      ) : null}

      <Section title="面试强度设置" hint="配置会随训练保存；二轮沿用首轮设置。基础重概念，进阶要求方案比较、边界和验证。">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">主问题数量<select className="cf-input mt-1 w-full p-2" value={settings.questionCount} onChange={(e) => setSettings({ ...settings, questionCount: Number(e.target.value) as 5 | 7 | 9 })}>{[5, 7, 9].map((n) => <option key={n} value={n}>{n} 道</option>)}</select></label>
          <label className="text-sm">训练难度<select className="cf-input mt-1 w-full p-2" value={settings.difficulty} onChange={(e) => setSettings({ ...settings, difficulty: e.target.value as InterviewSettings['difficulty'] })}><option value="basic">基础</option><option value="standard">标准</option><option value="advanced">进阶</option></select></label>
          <label className="text-sm">每题追问上限<select className="cf-input mt-1 w-full p-2" value={settings.maxFollowUps} onChange={(e) => setSettings({ ...settings, maxFollowUps: Number(e.target.value) as 0 | 1 | 2 })}>{[0, 1, 2].map((n) => <option key={n} value={n}>{n} 次</option>)}</select></label>
        </div><p className="mt-2 text-xs text-slate-500">总结题不追问；上限不等于必问次数。不同难度的得分不宜直接比较。</p>
      </Section>
      <Section title="输入简历">
        <div className="space-y-3">
          <textarea
            aria-label="简历正文"
            value={text}
            onChange={(e) => { setText(e.target.value); setAnalysis(null); setRecommendations([]); }}
            rows={10}
            placeholder="把简历全文粘贴到这里：教育经历、技能、项目经历、成果……"
            className="cf-input min-h-56 w-full p-4 font-mono text-sm leading-6"
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              onClick={recommend}
              disabled={loading}
              className="cf-button-secondary px-4 py-2 font-medium disabled:opacity-50"
            >
              {loading && operation === 'recommend' ? '推荐中…' : '根据简历推荐岗位'}
            </button>
            <button
              onClick={analyze}
              disabled={loading}
              className="cf-button-primary px-4 py-2 font-medium disabled:opacity-50"
            >
              {loading && operation === 'analyze' ? '分析中…' : '分析简历'}
            </button>
            <span className="text-slate-400">或</span>
            <input
              aria-label="上传 PDF 或 DOCX 简历"
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadDocument(f);
              }}
              className="max-w-full text-sm text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {uploading ? <span className="text-xs text-slate-500">正在提取文档文本…</span> : null}
          </div>
          <p className="text-xs text-slate-400">支持 PDF（15 MB）与 DOCX（5 MB），提取后可编辑确认。文本型 PDF 直接提取；扫描件会尝试使用配置的视觉模型 OCR。OCR 不可用时可直接粘贴简历文本。</p>
          {recovery}{message ? <p className="text-sm text-red-600">{message}</p> : null}
        </div>
      </Section>

      <Section title="选择目标岗位" hint="匹配度是简历与岗位描述的文本匹配程度，不代表录取概率">
        <div className="space-y-3 text-sm">
          <input
            aria-label="搜索岗位"
            value={roleQuery}
            onChange={(e) => setRoleQuery(e.target.value)}
            placeholder="搜索岗位方向，例如 Agent、后端、数据、云原生、安全……"
            className="cf-input w-full p-2.5"
          />
          <select
            aria-label="目标岗位"
            value={selectedRoleId}
            onChange={(e) => chooseRole(e.target.value)}
            className="cf-input w-full p-2.5"
          >
            <option value="">请选择岗位</option>
            {filteredRoles.map((r) => <option key={r.id} value={r.id}>{r.name}{r.category ? ` · ${r.category}` : ''}</option>)}
          </select>
          {selectedRole ? <p className="text-xs text-slate-500">{selectedRole.description}</p> : null}
          {selectedRole?.kind === 'job_posting' ? <JobSource provenance={selectedRole.provenance} /> : null}
          {recommendations.length ? (
            <div className="space-y-2">
              <p className="font-medium text-slate-700">推荐岗位（按匹配度排序）</p>
              {recommendations.map((rec) => (
                <button
                  key={rec.role.id}
                  onClick={() => chooseRole(rec.role.id)}
                  className={`block w-full rounded border p-3 text-left ${selectedRoleId === rec.role.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700">{rec.role.name}</span>
                    <span className="whitespace-nowrap font-semibold text-amber-500" title={`${rec.score} 分匹配度`}>
                      {'★'.repeat(rec.stars)}<span className="text-slate-200">{'★'.repeat(5 - rec.stars)}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{rec.reason}</p>
                  <div className="mt-2 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                    <div className="rounded bg-emerald-50 p-2">
                      <p className="font-medium text-emerald-800">已匹配技能与证据</p>
                      <ul className="mt-1 space-y-1">
                        {(rec.skillEvidence.length ? rec.skillEvidence : rec.matchedSkills.slice(0, 3).map((skill) => ({ skill, quote: '已从简历中识别相关描述' }))).slice(0, 3).map((item) => (
                          <li key={item.skill}><span className="font-medium text-slate-700">{item.skill}</span>：{item.quote}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded bg-amber-50 p-2">
                      <p className="font-medium text-amber-800">能力缺口与下一步</p>
                      <ul className="mt-1 space-y-1">
                        {(rec.gapDetails.length ? rec.gapDetails : rec.gaps.slice(0, 3).map((skill) => ({ skill, why: '暂未找到明确证据', nextStep: `补充${skill}的项目使用说明` }))).slice(0, 3).map((item) => (
                          <li key={item.skill}><span className="font-medium text-slate-700">{item.skill}</span>：{item.nextStep}</li>
                        ))}
                        {!rec.gaps.length && !rec.gapDetails.length ? <li>暂无明显必备技能缺口</li> : null}
                      </ul>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
          {selectedRoleId && !analysis ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs text-blue-800">
                已选择「{selectedRole?.name ?? '当前岗位'}」，下一步分析这份简历与该岗位的匹配缺口。
              </p>
              <button
                onClick={analyze}
                disabled={loading}
                className="cf-button-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {loading && operation === 'analyze' ? '分析中…' : '继续分析此岗位 →'}
              </button>
            </div>
          ) : null}
        </div>
      </Section>

      <Section title="导入真实招聘描述" hint="粘贴完整 JD 并记录来源，或采集 Greenhouse 公开岗位；核对后再保存用于训练。">
        <div className="space-y-3">
          <label className="block text-sm">岗位来源链接（选填）<input type="url" value={sourceUrl} maxLength={2048} onChange={(e) => { setSourceUrl(e.target.value); setCollectedSource(undefined); setCollectionReceipt(undefined); setJobDraft(null); }} placeholder="https://boards.greenhouse.io/公司/jobs/岗位编号" className="cf-input mt-1 w-full p-2.5" /></label>
          <div className="flex flex-wrap items-center gap-3"><button onClick={collectJob} className="cf-button-secondary px-4 py-2 text-sm font-medium disabled:opacity-50">{collectingJob ? '获取岗位中…' : '采集 Greenhouse 岗位'}</button><p className="text-xs text-slate-500">仅支持公开 Greenhouse 单个岗位链接；其他来源请手动粘贴。</p></div>
          <label className="block text-sm">公司名称（选填）<input value={company} maxLength={200} onChange={(e) => { setCompany(e.target.value); setCollectedSource(undefined); setCollectionReceipt(undefined); setJobDraft(null); }} className="cf-input mt-1 w-full p-2.5" /></label>
          <textarea
            aria-label="招聘描述 JD"
            value={jobText}
            onChange={(e) => { setJobText(e.target.value); setCollectedSource(undefined); setCollectionReceipt(undefined); setJobDraft(null); }}
            rows={6}
            placeholder="粘贴岗位名称、工作职责、必备技能、加分项等招聘描述……"
            className="cf-input min-h-36 w-full p-3 text-sm leading-6"
          />
          {collectedSource ? <JobSource provenance={collectedSource} /> : jobText ? <p className="text-xs text-slate-500">当前内容按手动导入记录，来源链接为用户提供。</p> : null}
          <p className="text-xs text-slate-500">请仅导入有权使用的岗位内容。修改采集正文、来源或公司后，将按手动导入记录。</p>
          <button
            onClick={() => importJob()}
            disabled={importingJob}
            className="cf-button-secondary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {importingJob ? '解析岗位中…' : '解析并预览岗位'}
          </button>
        </div>
      </Section>

      {jobDraft ? <Section title="确认目标岗位" hint="以下为解析整理内容，请对照上方 JD 原文修正后保存">
        <div className="grid gap-3 md:grid-cols-2">{([['title', '岗位名称'], ['description', '岗位简介'], ['responsibilities', '职责（每行一项）'], ['requiredSkills', '必备技能（每行一项）'], ['preferredSkills', '加分技能（每行一项）']] as const).map(([key, label]) => <label key={key} className="text-sm">{label}<textarea value={jobDraft[key]} onChange={(event) => setJobDraft({ ...jobDraft, [key]: event.target.value })} className="cf-input mt-1 w-full p-3" rows={key === 'title' ? 1 : 3} /></label>)}</div>
        <p className="mt-3 text-xs text-slate-500">确认后的岗位内容将用于本次训练快照。内存演示模式下，重启服务会丢失保存内容。</p>
        <button disabled={importingJob} onClick={() => importJob(true)} className="cf-button-primary mt-3 px-4 py-2">确认并保存岗位</button>
      </Section> : null}
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

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium text-slate-700">下一步：开始模拟面试</p>
            <div className="flex justify-end">
            <button
              onClick={startInterview}
              disabled={starting}
              className="cf-button-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {starting ? '准备面试中…' : '用这份简历开始模拟面试 →'}
            </button>
            </div>
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
    </fieldset>
  );
}

export default function ResumePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">加载中…</p>}>
      <ResumeClient />
    </Suspense>
  );
}
