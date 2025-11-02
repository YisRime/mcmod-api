import type { NextApiRequest, NextApiResponse } from 'next';
import { serveModPack as _serveModPack } from '../src/api/pages/modpack';
import { createErrorResponse, sendCors } from './_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    sendCors(res);
    res.status(204).end();
    return;
  }
  try {
    const params = new URLSearchParams(req.query as any);
    const result = await _serveModPack(params);
    const data = await result.json();
    sendCors(res);
    res.status(result.status).json(data);
  } catch (error) {
    createErrorResponse(res, error);
  }
}
