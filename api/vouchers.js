import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Thêm CORS headers cho phép mọi nguồn (hoặc chỉ shopee.vn)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const chatId = req.query.chat_id;
  if (!chatId) {
    return res.status(400).json({ error: 'Missing chat_id' });
  }

  try {
    const vouchers = await kv.get(chatId);
    res.status(200).json(Array.isArray(vouchers) ? vouchers : []);
  } catch (err) {
    console.error('Vouchers error:', err);
    res.status(200).json([]);
  }
}
