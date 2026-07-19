export const config = {
  runtime: 'edge',
};

import { kv } from '@vercel/kv';

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  const body = await req.json();
  const msg = body.message;

  // Trả về response ngay lập tức để tránh timeout
  const response = new Response('OK', { status: 200 });

  if (!msg || !msg.text) return response;

  // Xử lý bất đồng bộ trong nền
  (async () => {
    try {
      const chatId = msg.chat.id.toString();
      const text = msg.text.trim();
      let vouchers = (await kv.get(chatId)) || [];

      if (text.startsWith('/add ')) {
        try {
          const jsonStr = text.slice(5);
          const v = JSON.parse(jsonStr);
          if (!v.promotionid || !v.voucher_code || !v.signature) throw new Error('Thiếu');

          if (vouchers.some(item => item.voucher_code === v.voucher_code)) {
            await sendMessage(chatId, `⚠️ Voucher ${v.voucher_code} đã tồn tại.`);
          } else {
            vouchers.push({ voucher_code: v.voucher_code, promotionid: v.promotionid, signature: v.signature });
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
      console.error('Background error:', err);
    }
  })();

  return response;
}

async function sendMessage(chatId, text) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
