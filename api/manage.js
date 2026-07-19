import { kv } from '@vercel/kv';

// Cho phép mọi nguồn gọi API (CORS)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let chatId;
  if (req.method === 'GET') {
    chatId = req.query.chat_id;
  } else if (req.method === 'POST') {
    try {
      const body = req.body;
      chatId = body?.chat_id;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  if (!chatId) {
    return res.status(400).json({ error: 'Missing chat_id' });
  }

  try {
    // GET: lấy danh sách voucher của kênh
    if (req.method === 'GET') {
      const vouchers = await kv.get(chatId);
      return res.status(200).json(Array.isArray(vouchers) ? vouchers : []);
    }

    // POST: thêm, xóa, cập nhật voucher
    if (req.method === 'POST') {
      const {
        action,
        voucher_code,
        promotionid,
        signature,
        message,
        check_interval,
        active_hours
      } = req.body;

      let vouchers = (await kv.get(chatId)) || [];

      // --- ACTION: ADD ---
      if (action === 'add') {
        if (!promotionid || !voucher_code || !signature) {
          return res.status(400).json({ error: 'Thiếu thông tin voucher (promotionid, voucher_code, signature)' });
        }
        // Kiểm tra trùng mã
        if (vouchers.some(v => v.voucher_code === voucher_code)) {
          return res.status(409).json({ error: 'Voucher đã tồn tại' });
        }
        const newVoucher = {
          voucher_code,
          promotionid,
          signature,
          message: message || '',
          check_interval: parseInt(check_interval) || 60,
          active_hours: active_hours || ''
        };
        vouchers.push(newVoucher);
        await kv.set(chatId, vouchers);
        return res.status(200).json({ success: true, vouchers });
      }

      // --- ACTION: DELETE ---
      else if (action === 'delete') {
        const index = vouchers.findIndex(v => v.voucher_code === voucher_code);
        if (index === -1) {
          return res.status(404).json({ error: 'Không tìm thấy voucher' });
        }
        vouchers.splice(index, 1);
        await kv.set(chatId, vouchers);
        return res.status(200).json({ success: true, vouchers });
      }

      // --- ACTION: UPDATE ---
      else if (action === 'update') {
        const index = vouchers.findIndex(v => v.voucher_code === voucher_code);
        if (index === -1) {
          return res.status(404).json({ error: 'Không tìm thấy voucher' });
        }
        // Chỉ cập nhật các trường được truyền lên (nếu có)
        if (promotionid !== undefined) vouchers[index].promotionid = promotionid;
        if (signature !== undefined) vouchers[index].signature = signature;
        if (message !== undefined) vouchers[index].message = message;
        if (check_interval !== undefined) vouchers[index].check_interval = parseInt(check_interval) || 60;
        if (active_hours !== undefined) vouchers[index].active_hours = active_hours;
        await kv.set(chatId, vouchers);
        return res.status(200).json({ success: true, vouchers });
      }

      // --- ACTION không hợp lệ ---
      else {
        return res.status(400).json({ error: 'Action không hợp lệ. Hỗ trợ: add, delete, update' });
      }
    }

    // Phương thức không được hỗ trợ
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Manage API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
