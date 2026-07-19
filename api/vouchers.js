import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { chat_id } = req.query;
  if (!chat_id) return res.status(400).json({ error: 'Missing chat_id' });

  const vouchers = (await kv.get(chat_id)) || [];
  res.status(200).json(vouchers);
}
