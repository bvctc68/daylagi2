import { kv } from '@vercel/kv';

const TARGET_CHAT_ID = '-1002109878033'; // ID kênh của bạn

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end('OK');
  const { message } = req.body;
  if (!message?.text) return res.status(200).end('OK');

  const text = message.text.trim();

  try {
    let vouchers = (await kv.get(TARGET_CHAT_ID)) || [];

    if (text.startsWith('/add ')) {
      try {
        const v = JSON.parse(text.slice(5));
        if (!v.promotionid || !v.voucher_code || !v.signature) throw new Error('Thiếu');
        if (vouchers.some(e => e.voucher_code === v.voucher_code)) {
          await sendMessage(TARGET_CHAT_ID, `⚠️ Voucher ${v.voucher_code} đã tồn tại.`);
          // Cũng báo lại cho người gửi lệnh (cá nhân)
          await sendMessage(message.chat.id.toString(), `⚠️ Voucher ${v.voucher_code} đã tồn tại.`);
        } else {
          vouchers.push({ voucher_code: v.voucher_code, promotionid: v.promotionid, signature: v.signature });
          await kv.set(TARGET_CHAT_ID, vouchers);
          await sendMessage(TARGET_CHAT_ID, `✅ Đã thêm voucher ${v.voucher_code} vào kênh.`);
          await sendMessage(message.chat.id.toString(), `✅ Đã thêm voucher ${v.voucher_code} vào kênh.`);
        }
      } catch {
        await sendMessage(message.chat.id.toString(), '❌ JSON không hợp lệ.');
      }
    } else if (text.startsWith('/dele ')) {
      const code = text.slice(6).trim();
      const idx = vouchers.findIndex(e => e.voucher_code === code);
      if (idx === -1) {
        await sendMessage(message.chat.id.toString(), `❌ Không tìm thấy voucher ${code}.`);
      } else {
        vouchers.splice(idx, 1);
        await kv.set(TARGET_CHAT_ID, vouchers);
        await sendMessage(TARGET_CHAT_ID, `🗑️ Đã xóa voucher ${code} khỏi kênh.`);
        await sendMessage(message.chat.id.toString(), `🗑️ Đã xóa voucher ${code} khỏi kênh.`);
      }
    } else if (text === '/list') {
      const list = vouchers.map(v => `• ${v.voucher_code}`).join('\n') || 'Trống';
      await sendMessage(message.chat.id.toString(), `📋 Danh sách trong kênh:\n${list}`);
    } else {
      await sendMessage(message.chat.id.toString(), 'Lệnh không hợp lệ. Dùng:\n/add {json}\n/dele <mã>\n/list');
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
