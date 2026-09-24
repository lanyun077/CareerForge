'use client';

import { useCallback, useState } from 'react';

/** 保留页面状态；登录后只重载读取请求，不自动重放提交或删除。 */
export function useAuthRecovery() {
  const [needsLogin, setNeedsLogin] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const request = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);
    if (response.status === 401) setNeedsLogin(true);
    else if (response.ok) setNeedsLogin(false);
    return response;
  }, []);
  const recovery = needsLogin ? <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    <p>请重新登录。当前页面输入已保留，请勿刷新或关闭本页。</p>
    <a href="/login?recovery=1" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline">在新页面登录</a>
    <button type="button" onClick={() => setRetryVersion((value) => value + 1)} className="ml-4 underline">已登录，重新加载</button>
    <p className="mt-2">登录后请返回本页。提交、开始训练和删除操作需要重新点击。</p>
  </div> : null;
  return { request, recovery, retryVersion };
}
