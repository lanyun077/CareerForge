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
      <body className="cf-shell flex min-h-screen flex-col text-slate-800">
        <header className="border-b border-slate-800 bg-[#172033] text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#64c7bd] text-sm font-black text-[#172033]">CF</span>
              <span className="text-base font-bold tracking-tight">CareerForge</span>
              <span className="hidden border-l border-white/20 pl-3 text-xs text-slate-300 sm:inline">AI 求职实训工作台</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm text-slate-300">
              <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-white/10 hover:text-white">
                首页
              </Link>
              <Link href="/records" className="rounded-md px-3 py-1.5 hover:bg-white/10 hover:text-white">
                训练记录
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-5 text-xs leading-relaxed text-slate-500">
            <p>
              本系统为求职训练辅助工具，不用于真实招聘决策；内置岗位为模拟岗位，不代表任何真实公司的招聘标准。
            </p>
            <p>
              报告中的分数为「模拟表现分 / 岗位准备度」，基于回答证据与固定评分规则计算，不是录取概率；不基于性别、年龄、地域、学校层次评价求职能力。
            </p>
            <p>
              训练数据默认保存在服务器内存中（重启即清空）；配置 DATABASE_URL
              后持久化到 PostgreSQL。均可随时删除。
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
