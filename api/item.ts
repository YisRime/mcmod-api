import type { NextApiRequest, NextApiResponse } from 'next';
import { serveItem as _serveItem } from '../src/api/pages/item';
import { createErrorResponse, sendCors } from './_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    sendCors(res);
    res.status(204).end();
    return;
  }
  try {
    const params = new URLSearchParams(req.query as any);
    const result = await _serveItem(params);
    const data = await result.json();
    sendCors(res);
    res.status(result.status).json(data);
  } catch (error) {
    createErrorResponse(res, error);
  }
}
