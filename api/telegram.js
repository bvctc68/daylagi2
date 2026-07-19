import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).end();

  const { message } = req.body;
  if (!message?.text) return res.status(200).end();

  const chatId = message.chat.id.toString();
  const text = message.text.trim();
  const match = text.match(/^\/(add|dele)\s*(.*)/s);

  if (!match) {
    await sendMessage(chatId, 'Lệnh không hợp lệ.\n/add {json}\n/dele <mã_voucher>');
    return res.status(200).end();
  }

  const command = match[1];
  const args = match[2].trim();

  // Lấy danh sách voucher hiện tại của người dùng
  let vouchers = (await kv.get(chatId)) || [];

  if (command === 'add') {
    try {
      const v = JSON.parse(args);
      if (!v.promotionid || !v.voucher_code || !v.signature) throw new Error();
      // Kiểm tra trùng
      if (vouchers.some(e => e.voucher_code === v.voucher_code)) {
        await sendMessage(chatId, `⚠️ Voucher ${v.voucher_code} đã tồn tại.`);
      } else {
        vouchers.push({
          voucher_code: v.voucher_code,
          promotionid: v.promotionid,
          signature: v.signature
        });
        await kv.set(chatId, vouchers);
        await sendMessage(chatId, `✅ Đã thêm ${v.voucher_code} vào theo dõi.`);
      }
    } catch {
      await sendMessage(chatId, '❌ JSON không hợp lệ. Cần promotionid, voucher_code, signature.');
    }
  } else if (command === 'dele') {
    const code = args;
    const index = vouchers.findIndex(e => e.voucher_code === code);
    if (index === -1) {
      await sendMessage(chatId, `❌ Không tìm thấy voucher ${code}.`);
    } else {
      vouchers.splice(index, 1);
      await kv.set(chatId, vouchers);
      await sendMessage(chatId, `🗑️ Đã xóa ${code} khỏi danh sách.`);
    }
  }

  res.status(200).end();
}

// Hàm tiện ích gửi tin nhắn Telegram
async function sendMessage(chatId, text) {
  const token = process.env.BOT_TOKEN; // Sẽ set trong bước sau
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}
