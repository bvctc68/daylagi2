(function() {
  // ========= CẤU HÌNH =========
  const BOT_TOKEN = '8906414234:AAFNzObE52Ky3NgxEc1D5johv4PMKZGD3X8'; // Token bot
  const APPS_SCRIPT_URL = 'https://your-app.vercel.app/api/vouchers'; // <-- Thay bằng URL của bạn

  // Lấy chat_id từ localStorage, nếu chưa có thì hỏi người dùng
  let chatId = localStorage.getItem('telegram_chat_id');
  if (!chatId) {
    chatId = prompt('Nhập chat ID của bạn (số, không dấu cách):');
    if (chatId) {
      localStorage.setItem('telegram_chat_id', chatId);
    } else {
      alert('Cần nhập chat ID để hoạt động.');
      return;
    }
  }

  // ========= HÀM GỌI API =========
  async function getVoucherList() {
    const res = await fetch(`${APPS_SCRIPT_URL}?chat_id=${chatId}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function sendTelegram(text) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
      });
    } catch(e) {
      console.error('Telegram error:', e);
    }
  }

  // ========= KIỂM TRA VOUCHER =========
  async function checkVoucher(v) {
    const storageKey = `vstate_${v.voucher_code}`;
    try {
      const res = await fetch('https://shopee.vn/api/v2/voucher_wallet/get_voucher_detail', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          promotionid: v.promotionid,
          voucher_code: v.voucher_code,
          signature: v.signature,
          need_basic_info: true,
          need_user_voucher_status: true,
          source: '0',
          addition: []
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (json.error !== 0) throw new Error('API error ' + json.error);

      const info = json.data.voucher_basic_info;
      const now = {
        fully_used: info.fully_used,
        left_count: info.left_count,
        percentage_used: info.percentage_used
      };

      const prev = JSON.parse(localStorage.getItem(storageKey) || 'null');

      if (!prev) {
        localStorage.setItem(storageKey, JSON.stringify(now));
        console.log(`[${v.voucher_code}] Initial state saved.`);
        return;
      }

      const wasExhausted = prev.fully_used === true || prev.left_count === 0;
      const isAvailable = now.fully_used === false || (now.left_count !== null && now.left_count > 0);

      if (wasExhausted && isAvailable) {
        const msg = `🎉 Voucher *${v.voucher_code}* có lại lượt!\nĐã dùng: ${now.percentage_used}%\nCòn lại: ${now.left_count !== null ? now.left_count : 'không giới hạn'}`;
        await sendTelegram(msg);
        console.log(`[${v.voucher_code}] Đã gửi Telegram.`);
      } else {
        console.log(`[${v.voucher_code}] Trạng thái không đổi.`);
      }

      localStorage.setItem(storageKey, JSON.stringify(now));
    } catch(err) {
      console.error(`[${v.voucher_code}] Lỗi:`, err.message);
    }
  }

  // ========= VÒNG LẶP CHÍNH =========
  async function runChecks() {
    console.log('🔄 Đang lấy danh sách voucher từ backend...');
    const vouchers = await getVoucherList();
    console.log(`📋 Tìm thấy ${vouchers.length} voucher.`);
    for (const v of vouchers) {
      await checkVoucher(v);
    }
    const delay = 60000 + Math.floor(Math.random() * 30000); // 60-90 giây
    console.log(`⏳ Kiểm tra tiếp sau ${(delay/1000).toFixed(0)} giây.`);
    setTimeout(runChecks, delay);
  }

  // ========= KHỞI ĐỘNG =========
  if (window._voucherMonitorStarted) {
    console.log('Script đã chạy rồi.');
    return;
  }
  window._voucherMonitorStarted = true;
  console.log('🚀 Bot giám sát voucher đã khởi động.');
  runChecks();
})();
