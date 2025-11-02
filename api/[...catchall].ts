// 兜底 404 路由，返回统一 JSON
import type { NextApiRequest, NextApiResponse } from 'next';
import { createErrorResponse } from './_utils';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  createErrorResponse(res, { error: '路径不存在', message: '请使用有效的 API 端点', status: 404 });
}
