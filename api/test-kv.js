import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const testId = req.query.chat_id || 'test_user';
  try {
    // Ghi một mảng test vào KV
    await kv.set(testId, [{ voucher_code: 'TEST', promotionid: 123, signature: 'abc' }]);
    // Đọc lại từ KV
    const data = await kv.get(testId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('KV Test Error:', err);
    res.status(500).json({ error: err.message });
  }
}
