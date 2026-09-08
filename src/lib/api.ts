import { NextResponse } from 'next/server';

/** 统一响应封装：{ ok: true, data } | { ok: false, message, code } */
export function ok<T>(data: T) {
  return NextResponse.json({ ok: true, data });
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, message, code }, { status });
}

/** 服务层业务错误，携带 HTTP 状态码 */
export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
