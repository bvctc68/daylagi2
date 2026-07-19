// api/manage.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Xử lý preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Lấy chat_id từ query (GET) hoặc body (POST)
  let chatId;
  if (req.method === 'GET') {
    chatId = req.query.chat_id;
  } else {
    const body = req.body;
    chatId = body?.chat_id;
  }

  if (!chatId) {
    return res.status(400).json({ error: 'Missing chat_id' });
  }

  try {
    // GET: lấy danh sách voucher (giống api/vouchers nhưng để cùng file cho tiện)
    if (req.method === 'GET') {
      const vouchers = await kv.get(chatId);
      return res.status(200).json(Array.isArray(vouchers) ? vouchers : []);
    }

    // POST: thêm hoặc xóa (dựa vào action trong body)
    if (req.method === 'POST') {
      const { action, voucher_code, promotionid, signature } = req.body;
      let vouchers = (await kv.get(chatId)) || [];

      if (action === 'add') {
        if (!promotionid || !voucher_code || !signature) {
          return res.status(400).json({ error: 'Thiếu thông tin voucher' });
        }
        // Kiểm tra trùng
        if (vouchers.some(v => v.voucher_code === voucher_code)) {
          return res.status(409).json({ error: 'Voucher đã tồn tại' });
        }
        vouchers.push({ voucher_code, promotionid, signature });
        await kv.set(chatId, vouchers);
        return res.status(200).json({ success: true, vouchers });
      } else if (action === 'delete') {
        const index = vouchers.findIndex(v => v.voucher_code === voucher_code);
        if (index === -1) {
          return res.status(404).json({ error: 'Không tìm thấy voucher' });
        }
        vouchers.splice(index, 1);
        await kv.set(chatId, vouchers);
        return res.status(200).json({ success: true, vouchers });
      } else {
        return res.status(400).json({ error: 'Action không hợp lệ' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Manage error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
