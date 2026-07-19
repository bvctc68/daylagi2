import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge', // chạy nhanh, nhẹ
};

export default async function handler(req) {
  // Chỉ chấp nhận POST
  if (req.method !== 'POST') {
    return new Response('Only POST allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { message } = body;
    if (!message?.text) {
      return new Response('No message text', { status: 200 });
    }

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    // Regex tách lệnh /add hoặc /dele
    const match = text.match(/^\/(add|dele)\s*(.*)/s);
    if (!match) {
      await sendMessage(chatId, 'Lệnh không hợp lệ. Dùng:\n/add {json}\n/dele <mã_voucher>');
      return new Response('OK', { status: 200 });
    }

    const command = match[1];
    const args = match[2].trim();

    // Lấy danh sách voucher hiện tại từ KV
    let vouchers = (await kv.get(chatId)) || [];

    if (command === 'add') {
      try {
        const v = JSON.parse(args);
        if (!v.promotionid || !v.voucher_code || !v.signature) {
          throw new Error('Thiếu trường dữ liệu');
        }
        // Kiểm tra trùng
        const exists = vouchers.some(item => item.voucher_code === v.voucher_code);
        if (exists) {
          await sendMessage(chatId, `⚠️ Voucher ${v.voucher_code} đã có trong danh sách.`);
        } else {
          vouchers.push({
            voucher_code: v.voucher_code,
            promotionid: v.promotionid,
            signature: v.signature
          });
          await kv.set(chatId, vouchers);
          await sendMessage(chatId, `✅ Đã thêm voucher ${v.voucher_code} vào theo dõi.`);
        }
      } catch (e) {
        await sendMessage(chatId, '❌ JSON không hợp lệ. Gửi đúng định dạng:\n/add {"promotionid":...,"voucher_code":"...","signature":"..."}');
      }
    } else if (command === 'dele') {
      const code = args;
      const index = vouchers.findIndex(item => item.voucher_code === code);
      if (index === -1) {
        await sendMessage(chatId, `❌ Không tìm thấy voucher ${code}.`);
      } else {
        vouchers.splice(index, 1);
        await kv.set(chatId, vouchers);
        await sendMessage(chatId, `🗑️ Đã xóa voucher ${code} khỏi danh sách.`);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Hàm gửi tin nhắn Telegram
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
    body: JSON.stringify({ chat_id: chatId, text })
  });
}
