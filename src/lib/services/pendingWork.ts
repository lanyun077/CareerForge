import type { Store } from '@/lib/types';

// Store 实例对应当前用户；只复用进行中的任务，成功和失败都立即清理。
const pending = new WeakMap<Store, Map<string, Promise<unknown>>>();

export function sharePending<T>(store: Store, key: string, work: () => Promise<T>): Promise<T> {
  let tasks = pending.get(store);
  if (!tasks) { tasks = new Map(); pending.set(store, tasks); }
  const existing = tasks.get(key);
  if (existing) return existing as Promise<T>;
  const task = Promise.resolve().then(work).finally(() => { tasks!.delete(key); });
  tasks.set(key, task);
  return task;
}
