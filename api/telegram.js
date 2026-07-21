import { kv } from '@vercel/kv';

const TARGET_CHAT_ID = '-1001578007378'; // ID kênh lưu trữ dữ liệu
const ALLOWED_USERS = ['1400175163']; // Thay bằng ID Telegram của bạn (có thể thêm nhiều)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end('OK');
  const { message } = req.body;
  if (!message?.text) return res.status(200).end('OK');

  const fromId = message.from?.id?.toString(); // ID người gửi
  const replyTo = message.chat.id.toString();   // Nơi nhận phản hồi (có thể là chat riêng hoặc kênh)

  // Kiểm tra quyền
  if (!ALLOWED_USERS.includes(fromId)) {
    await sendMessage(replyTo, '⛔ Bạn không có quyền sử dụng bot này.');
    return res.status(200).end();
  }

  const text = message.text.trim();

  try {
    let vouchers = (await kv.get(TARGET_CHAT_ID)) || [];

    if (text.startsWith('/add ')) {
      const input = text.slice(5).trim();
      let code, promo, sign, msg = '';

      if (input.startsWith('http')) {
        try {
          const urlObj = new URL(input);
          const params = new URLSearchParams(urlObj.search);
          code = params.get('evcode') || '';
          promo = params.get('promotionId') || params.get('promotionid') || '';
          sign = params.get('signature') || '';
        } catch {
          await sendMessage(replyTo, '❌ URL không hợp lệ.');
          return res.status(200).end();
        }
      } else {
        try {
          const v = JSON.parse(input);
          code = v.voucher_code;
          promo = v.promotionid;
          sign = v.signature;
          msg = v.message || '';
        } catch {
          await sendMessage(replyTo, '❌ Không nhận diện được định dạng. Gửi URL hoặc JSON.');
          return res.status(200).end();
        }
      }

      if (!code || !promo || !sign) {
        await sendMessage(replyTo, '❌ Thiếu thông tin (cần evcode, promotionId, signature).');
        return res.status(200).end();
      }

      if (vouchers.some(e => e.voucher_code === code)) {
        await sendMessage(replyTo, `⚠️ Voucher ${code} đã tồn tại.`);
      } else {
        vouchers.push({
          voucher_code: code,
          promotionid: Number(promo),
          signature: sign,
          message: msg,
          active_hours: '',
          check_interval: 60
        });
        await kv.set(TARGET_CHAT_ID, vouchers);
        await sendMessage(replyTo, `✅ Đã thêm voucher ${code}.`);
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
      await sendMessage(replyTo, 'Lệnh không hợp lệ. Dùng:\n/add <URL hoặc JSON>\n/dele <mã>\n/list');
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
