import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL,
});

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
    let raw = await redis.get(chatId);
    const vouchers = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify(vouchers), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Vouchers API error:', err);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
