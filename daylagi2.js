(function() {
  // ========= CẤU HÌNH =========
  const BOT_TOKEN = '8906414234:AAFNzObE52Ky3NgxEc1D5johv4PMKZGD3X8'; // Token bot
  const APPS_SCRIPT_URL = 'https://daylagi2.vercel.app/api/vouchers'; // URL API lấy danh sách voucher

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
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?chat_id=${chatId}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch(e) {
      console.error('Lỗi lấy danh sách voucher:', e);
      return [];
    }
  }

  async function sendTelegram(text) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
      });
      if (!res.ok) {
        console.error('Telegram API error:', res.status);
      }
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
        console.log(`[${v.voucher_code}] Lần đầu kiểm tra, đã lưu trạng thái.`);
        return;
      }

      const wasExhausted = prev.fully_used === true || prev.left_count === 0;
      const isAvailable = now.fully_used === false || (now.left_count !== null && now.left_count > 0);

      if (wasExhausted && isAvailable) {
        const msg = `🎉 Voucher *${v.voucher_code}* có lại lượt!\nĐã dùng: ${now.percentage_used}%\nCòn lại: ${now.left_count !== null ? now.left_count : 'không giới hạn'}`;
        await sendTelegram(msg);
        console.log(`[${v.voucher_code}] Đã gửi thông báo Telegram.`);
      } else {
        console.log(`[${v.voucher_code}] Trạng thái không đổi.`);
      }

      localStorage.setItem(storageKey, JSON.stringify(now));
    } catch(err) {
      console.error(`[${v.voucher_code}] Lỗi:`, err.message);
    }
  }

  // ========= DỌN DẸP LOCALSTORAGE =========
  function cleanUpLocalStorage(activeCodes) {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vstate_')) {
        const code = key.replace('vstate_', '');
        if (!activeCodes.includes(code)) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🧹 Đã xóa trạng thái cũ của ${key.replace('vstate_', '')}`);
    });
  }

  // ========= VÒNG LẶP CHÍNH =========
  async function runChecks() {
    console.log('🔄 Đang lấy danh sách voucher từ backend...');
    const vouchers = await getVoucherList();
    console.log(`📋 Tìm thấy ${vouchers.length} voucher.`);

    // Dọn dẹp localStorage cho những voucher không còn trong danh sách
    const activeCodes = vouchers.map(v => v.voucher_code);
    cleanUpLocalStorage(activeCodes);

    // Kiểm tra từng voucher
    for (const v of vouchers) {
      await checkVoucher(v);
    }

    // Lên lịch cho lần kiểm tra tiếp theo (60-90 giây ngẫu nhiên)
    const delay = 60000 + Math.floor(Math.random() * 30000);
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
