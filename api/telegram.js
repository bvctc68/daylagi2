export const config = {
  runtime: 'edge',
};

import { kv } from '@vercel/kv';

export default async function handler(req) {
  // Chỉ chấp nhận POST
  if (req.method !== 'POST') {
    return new Response('OK', { status: 200 });
  }

  // Đọc body và xử lý bất đồng bộ, không chặn response
  const body = await req.json();
  const msg = body.message;

  // Quan trọng: trả về response NGAY LẬP TỨC
  const response = new Response('OK', { status: 200 });

  // Nếu không có tin nhắn, dừng
  if (!msg || !msg.text) {
    return response;
  }

  // Tất cả xử lý phía dưới sẽ chạy nền (fire-and-forget)
  (async () => {
    try {
      const chatId = msg.chat.id.toString();
      const text = msg.text.trim();

      // Lấy danh sách voucher hiện tại từ KV
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
              signature: v.signature,
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
    }
  })();

  // Trả response ngay, không đợi xong
  return response;
}

async function sendMessage(chatId, text) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error('sendMessage error:', e);
  }
}
