'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Section } from '@/app/components/Section';
import type { SessionSummary } from '@/lib/types';

export default function RecordsPage() {
  const [records, setRecords] = useState<SessionSummary[] | null>(null);
  const [deleting, setDeleting] = useState('');

  function load() {
    fetch('/api/records')
      .then((r) => r.json())
      .then((b) => setRecords(b.ok ? (b.data as SessionSummary[]) : []))
      .catch(() => setRecords([]));
  }

  useEffect(load, []);

  async function remove(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/records?id=${id}`, { method: 'DELETE' });
      load();
    } finally {
      setDeleting('');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">训练记录</h1>
        <p className="mt-1 text-sm text-slate-500">
          数据保存在服务器内存中（重启即清空）。你也可以随时删除任意一条记录（含其简历分析与报告）。
        </p>
      </div>

      <Section title="记录列表">
        {records === null ? (
          <p className="text-sm text-slate-500">加载中…</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-slate-500">
            暂无训练记录，去
            <Link href="/" className="mx-1 text-blue-600 hover:underline">
              首页
            </Link>
            开始第一次训练。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="py-1.5">时间</th>
                  <th className="py-1.5">岗位</th>
                  <th className="py-1.5">轮次</th>
                  <th className="py-1.5">状态</th>
                  <th className="py-1.5">模拟表现分</th>
                  <th className="py-1.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-500">
                      {new Date(r.startedAt).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                    <td className="py-2 text-slate-700">{r.roleName}</td>
                    <td className="py-2 text-slate-700">第 {r.round} 轮</td>
                    <td className="py-2">
                      {r.status === 'completed' ? (
                        <Badge tone="green">已完成</Badge>
                      ) : (
                        <Badge tone="amber">进行中</Badge>
                      )}
                    </td>
                    <td className="py-2 tabular-nums text-slate-700">
                      {r.overallScore !== undefined ? r.overallScore : '—'}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-3 text-xs">
                        {r.status === 'completed' ? (
                          <Link href={`/report/${r.id}`} className="text-blue-600 hover:underline">
                            查看报告
                          </Link>
                        ) : (
                          <Link
                            href={`/interview?sessionId=${r.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            继续训练
                          </Link>
                        )}
                        <button
                          onClick={() => remove(r.id)}
                          disabled={deleting === r.id}
                          className="text-red-500 hover:underline disabled:opacity-50"
                        >
                          {deleting === r.id ? '删除中…' : '删除'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
