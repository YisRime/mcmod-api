import type { NextApiRequest, NextApiResponse } from 'next';
import { genDoc as _genDoc } from '../src/api/utils/doc';
import { createErrorResponse, sendCors } from './_utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    sendCors(res);
    res.status(204).end();
    return;
  }
  try {
    const result = await _genDoc();
    const html = await result.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    sendCors(res);
    res.status(result.status).send(html);
  } catch (error) {
    createErrorResponse(res, error);
  }
}
