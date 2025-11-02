// 公共工具与常量，供所有 API 路由使用
import type { NextApiResponse } from 'next';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export const BASE_URL = "https://www.mcmod.cn";

export function sendCors(res: NextApiResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
}

export function createErrorResponse(res: NextApiResponse, error: any) {
  sendCors(res);
  const err = typeof error === 'string'
    ? { error: '错误', message: error, status: 500 }
    : 'error' in error
      ? error
      : { error: '错误', message: error.message, status: 500 };
  res.status(err.status || 500).json({ error: err.error, message: err.message });
}

export function createSuccessResponse(res: NextApiResponse, data: unknown) {
  sendCors(res);
  res.status(200).json(data);
}

export function validateId(value: string | null): string | { error: string; message: string; status: number } {
  if (!value) return { error: '参数缺失', message: '缺少ID参数', status: 400 };
  if (!/^\d+$/.test(value)) return { error: '无效参数', message: 'ID必须是数字', status: 400 };
  return value;
}
