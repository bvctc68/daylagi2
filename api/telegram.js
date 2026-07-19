import { kv } from '@vercel/kv';

const TARGET_CHAT_ID = '-1001846542105'; // ID kênh lưu trữ dữ liệu

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end('OK');
  const { message } = req.body;
  if (!message?.text) return res.status(200).end('OK');

  const text = message.text.trim();
  const replyTo = message.chat.id.toString(); // Người gửi lệnh (có thể là cá nhân hoặc kênh)

  try {
    let vouchers = (await kv.get(TARGET_CHAT_ID)) || [];

    if (text.startsWith('/add ')) {
      try {
        const v = JSON.parse(text.slice(5));
        if (!v.promotionid || !v.voucher_code || !v.signature) throw new Error('Thiếu');
        if (vouchers.some(e => e.voucher_code === v.voucher_code)) {
          await sendMessage(replyTo, `⚠️ Voucher ${v.voucher_code} đã tồn tại.`);
        } else {
          vouchers.push({ voucher_code: v.voucher_code, promotionid: v.promotionid, signature: v.signature, message: v.message || '' });
          await kv.set(TARGET_CHAT_ID, vouchers);
          await sendMessage(replyTo, `✅ Đã thêm voucher ${v.voucher_code}.`);
        }
      } catch {
        await sendMessage(replyTo, '❌ JSON không hợp lệ.');
      }
    } else if (text.startsWith('/dele ')) {
      const code = text.slice(6).trim();
      const idx = vouchers.findIndex(e => e.voucher_code === code);
      if (idx === -1) {
        await sendMessage(replyTo, `❌ Không tìm thấy voucher ${code}.`);
      } else {
        vouchers.splice(idx, 1);
        await kv.set(TARGET_CHAT_ID, vouchers);
        await sendMessage(replyTo, `🗑️ Đã xóa voucher ${code}.`);
      }
    } else if (text === '/list') {
      const list = vouchers.map(v => `• ${v.voucher_code}`).join('\n') || 'Trống';
      await sendMessage(replyTo, `📋 Danh sách trong kênh:\n${list}`);
    } else {
      await sendMessage(replyTo, 'Lệnh không hợp lệ. Dùng:\n/add {json}\n/dele <mã>\n/list');
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
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
