import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  let chatId;
  if (req.method === 'GET') {
    chatId = req.query.chat_id;
  } else {
    chatId = req.body?.chat_id;
  }
  if (!chatId) return res.status(400).json({ error: 'Missing chat_id' });

  try {
    if (req.method === 'GET') {
      const vouchers = await kv.get(chatId);
      return res.status(200).json(Array.isArray(vouchers) ? vouchers : []);
    }

    if (req.method === 'POST') {
      const { action, voucher_code, promotionid, signature, message } = req.body;
      let vouchers = (await kv.get(chatId)) || [];

      if (action === 'add') {
        if (!promotionid || !voucher_code || !signature) {
          return res.status(400).json({ error: 'Thiếu thông tin voucher' });
        }
        if (vouchers.some(v => v.voucher_code === voucher_code)) {
          return res.status(409).json({ error: 'Voucher đã tồn tại' });
        }
        vouchers.push({ voucher_code, promotionid, signature, message: message || '' });
        await kv.set(chatId, vouchers);
        return res.status(200).json({ success: true, vouchers });
      } 
      else if (action === 'delete') {
        const index = vouchers.findIndex(v => v.voucher_code === voucher_code);
        if (index === -1) return res.status(404).json({ error: 'Không tìm thấy voucher' });
        vouchers.splice(index, 1);
        await kv.set(chatId, vouchers);
        return res.status(200).json({ success: true, vouchers });
      } 
      else if (action === 'update') {
        const index = vouchers.findIndex(v => v.voucher_code === voucher_code);
        if (index === -1) return res.status(404).json({ error: 'Không tìm thấy voucher' });
        // Chỉ cập nhật các trường được gửi lên (không rỗng)
        if (promotionid) vouchers[index].promotionid = promotionid;
        if (signature) vouchers[index].signature = signature;
        if (message !== undefined) vouchers[index].message = message;
        await kv.set(chatId, vouchers);
        return res.status(200).json({ success: true, vouchers });
      }
      return res.status(400).json({ error: 'Action không hợp lệ' });
    }
    return res.status(405).end();
  } catch (err) {
    console.error('Manage error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
