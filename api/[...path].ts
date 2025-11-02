// Vercel 根路由重定向到 /api/index.ts 以兼容 /api/ 访问
import type { NextApiRequest, NextApiResponse } from 'next';
import indexHandler from './index';

export default indexHandler;
