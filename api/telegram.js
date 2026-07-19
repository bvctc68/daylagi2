export const config = {
  runtime: 'edge',
};

import { kv } from '@vercel/kv';

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });

  const body = await req.json();
  const msg = body.message;
  if (!msg?.text) return new Response('OK', { status: 200 });

  const chatId = msg.chat.id.toString();
  const text = msg.text.trim();

  // Xử lý nền với waitUntil
  const processPromise = (async () => {
    try {
      let vouchers = (await kv.get(chatId)) || [];

      if (text.startsWith('/add ')) {
        try {
          const v = JSON.parse(text.slice(5));
          if (!v.promotionid || !v.voucher_code || !v.signature) throw new Error('Thiếu');
          if (vouchers.some(e => e.voucher_code === v.voucher_code)) {
            await sendMessage(chatId, `⚠️ Voucher ${v.voucher_code} đã tồn tại.`);
          } else {
            vouchers.push({ voucher_code: v.voucher_code, promotionid: v.promotionid, signature: v.signature });
            await kv.set(chatId, vouchers);
            await sendMessage(chatId, `✅ Đã thêm voucher ${v.voucher_code}.`);
          }
        } catch {
          await sendMessage(chatId, '❌ JSON không hợp lệ. Gửi đúng:\n/add {"promotionid":...,"voucher_code":"...","signature":"..."}');
        }
      } else if (text.startsWith('/dele ')) {
        const code = text.slice(6).trim();
        const idx = vouchers.findIndex(e => e.voucher_code === code);
        if (idx === -1) {
          await sendMessage(chatId, `❌ Không tìm thấy voucher ${code}.`);
        } else {
          vouchers.splice(idx, 1);
          await kv.set(chatId, vouchers);
          await sendMessage(chatId, `🗑️ Đã xóa voucher ${code}.`);
        }
      } else if (text === '/list') {
        if (vouchers.length === 0) {
          await sendMessage(chatId, '📋 Danh sách voucher đang theo dõi: (trống)');
        } else {
          const list = vouchers.map(v => `• ${v.voucher_code}`).join('\n');
          await sendMessage(chatId, `📋 Danh sách voucher đang theo dõi:\n${list}`);
        }
      } else {
        await sendMessage(chatId, 'Lệnh không hợp lệ. Dùng:\n/add {json}\n/dele <mã_voucher>\n/list');
      }
    } catch (err) {
      console.error('Background error:', err);
    }
  })();

  return new Response('OK', { status: 200 });
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
