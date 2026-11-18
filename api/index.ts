import type { Request, Response } from 'express';
import { handleVercelRequest } from '../server.ts';

export default async function handler(req: Request, res: Response) {
  return handleVercelRequest(req, res);
}
