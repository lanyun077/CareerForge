import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'CareerForge · AI求职实训教练',
  description:
    '面向计算机专业学生的 AI 求职训练与复盘系统：岗位匹配分析、模拟面试、针对性追问、可解释评分复盘与两次训练对比。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold">
              CareerForge
              <span className="ml-2 text-sm font-normal text-slate-500">AI求职实训教练</span>
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:text-blue-600">
                首页
              </Link>
              <Link href="/records" className="hover:text-blue-600">
                训练记录
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl space-y-1 px-4 py-4 text-xs leading-relaxed text-slate-500">
            <p>
              本系统为求职训练辅助工具，不用于真实招聘决策；内置岗位为模拟岗位，不代表任何真实公司的招聘标准。
            </p>
            <p>
              报告中的分数为「模拟表现分 / 岗位准备度」，基于回答证据与固定评分规则计算，不是录取概率；不基于性别、年龄、地域、学校层次评价求职能力。
            </p>
            <p>训练数据保存在服务器内存中（重启即清空），可在「训练记录」页随时删除。</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
