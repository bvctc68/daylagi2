import { kv } from '@vercel/kv';

export default async function handler(req) {
  const url = new URL(req.url);
  const chatId = url.searchParams.get('chat_id');
  if (!chatId) {
    return new Response(JSON.stringify({ error: 'Missing chat_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const vouchers = (await kv.get(chatId)) || [];
    return new Response(JSON.stringify(vouchers), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Vouchers API error:', err);
    return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
