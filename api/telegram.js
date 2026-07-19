import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Chỉ chấp nhận POST
  if (req.method !== 'POST') {
    res.status(200).end('OK');
    return;
  }

  const { message } = req.body;

  // Trả response ngay lập tức
  res.status(200).json({ ok: true });

  // Nếu không có tin nhắn, dừng
  if (!message || !message.text) return;

  // Xử lý nền với waitUntil (nếu có) hoặc tự chạy async
  try {
    const chatId = message.chat.id.toString();
    const text = message.text.trim();
    let vouchers = (await kv.get(chatId)) || [];

    if (text.startsWith('/add ')) {
      try {
        const jsonStr = text.slice(5);
        const v = JSON.parse(jsonStr);
        if (!v.promotionid || !v.voucher_code || !v.signature) throw new Error('Thiếu');

        if (vouchers.some(item => item.voucher_code === v.voucher_code)) {
          await sendMessage(chatId, `⚠️ Voucher ${v.voucher_code} đã tồn tại.`);
        } else {
          vouchers.push({
            voucher_code: v.voucher_code,
            promotionid: v.promotionid,
            signature: v.signature
          });
          await kv.set(chatId, vouchers);
          await sendMessage(chatId, `✅ Đã thêm voucher ${v.voucher_code}.`);
        }
      } catch {
        await sendMessage(chatId, '❌ JSON không hợp lệ. Gửi đúng định dạng:\n/add {"promotionid":...,"voucher_code":"...","signature":"..."}');
      }
    } else if (text.startsWith('/dele ')) {
      const code = text.slice(6).trim();
      const index = vouchers.findIndex(item => item.voucher_code === code);
      if (index === -1) {
        await sendMessage(chatId, `❌ Không tìm thấy voucher ${code}.`);
      } else {
        vouchers.splice(index, 1);
        await kv.set(chatId, vouchers);
        await sendMessage(chatId, `🗑️ Đã xóa voucher ${code}.`);
      }
    } else {
      await sendMessage(chatId, 'Lệnh không hợp lệ. Dùng:\n/add {json}\n/dele <mã_voucher>');
    }
  } catch (err) {
    console.error('Background processing error:', err);
    try {
      await sendMessage(message.chat.id.toString(), '❌ Lỗi hệ thống, thử lại sau.');
    } catch (e) {}
  }
}

async function sendMessage(chatId, text) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('BOT_TOKEN is not set');
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
