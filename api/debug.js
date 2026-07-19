import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Chỉ cho phép GET để dễ test, có thể thêm bảo mật nếu cần
  const { chat_id, voucher_code, fully_used } = req.query;
  if (!chat_id || !voucher_code || fully_used === undefined) {
    return res.status(400).json({ error: 'Thiếu tham số: chat_id, voucher_code, fully_used' });
  }

  try {
    let vouchers = (await kv.get(chat_id)) || [];
    const index = vouchers.findIndex(v => v.voucher_code === voucher_code);
    if (index === -1) {
      return res.status(404).json({ error: 'Không tìm thấy voucher' });
    }

    // Cập nhật fully_used (và left_count nếu cần)
    vouchers[index].fully_used = fully_used === 'true';
    if (!vouchers[index].fully_used) {
      vouchers[index].left_count = 100; // giả lập có 100 lượt
    } else {
      vouchers[index].left_count = 0;
    }

    await kv.set(chat_id, vouchers);
    return res.status(200).json({ success: true, vouchers });
  } catch (err) {
    console.error('Debug error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
