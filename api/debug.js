export default async function handler(req, res) {
  const { chat_id, text } = req.query;
  if (!chat_id || !text) {
    return res.status(400).json({ error: 'Thiếu chat_id hoặc text' });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    return res.status(500).json({ error: 'BOT_TOKEN not set' });
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text }),
    });
    const data = await response.json();
    return res.status(200).json({ ok: data.ok, result: data });
  } catch (err) {
    console.error('Debug send error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
