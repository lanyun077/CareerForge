import type { JobPosting } from '@/lib/types';

export function JobSource({ provenance }: { provenance: JobPosting['provenance'] }) {
  if (!provenance) return <p className="text-xs text-slate-500">此岗位未记录可追溯来源，招聘有效性未核验。</p>;
  const date = new Date(provenance.collectedAt);
  const sourceUrl = provenance.sourceUrl && /^https?:\/\//i.test(provenance.sourceUrl) ? provenance.sourceUrl : undefined;
  return <div className="space-y-1 text-xs leading-5 text-slate-500">
    <p>{provenance.company ? `公司：${provenance.company} · ` : ''}{provenance.method === 'greenhouse_api' ? '来源：Greenhouse 公开岗位接口' : '来源：用户手动导入'}</p>
    {sourceUrl ? <p><a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-blue-600 hover:underline">查看岗位来源</a></p> : <p>未提供来源链接</p>}
    <p>记录时间：{Number.isNaN(date.getTime()) ? '未知' : date.toLocaleString('zh-CN')} · 招聘有效性未核验</p>
    <p>{provenance.method === 'greenhouse_api' ? '来源记录对应提取、脱敏后的正文，不是网页原文的完整副本。' : '来源链接由用户提供，未验证与导入正文一致。'}</p>
    <p>{provenance.requirementsReview === 'user_confirmed' ? '训练要求已经用户确认，可包含用户修改，未必等同来源原文。' : provenance.requirementsReview === 'automatic' ? '训练要求由程序自动提取，未必等同来源原文，请核对后使用。' : '未记录训练要求的确认状态，请对照来源核对。'}来源记录不代表提取结果已获来源方认可。</p>
    <p>训练参考保存时的岗位内容；来源页面可能已更新或关闭。</p>
  </div>;
}
