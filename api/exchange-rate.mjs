import { httpHandler } from '../lib/http-handler.mjs';

async function handle(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'GET') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers });
  const base = (new URL(request.url).searchParams.get('base') || 'GBP').toUpperCase();
  if (!['GBP', 'INR', 'EUR', 'USD'].includes(base)) return Response.json({ error: 'Unsupported source currency.' }, { status: 400, headers });
  if (base === 'USD') return Response.json({ base, quote: 'USD', rate: 1, date: null }, { headers });
  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/usd`, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw Error('Exchange-rate provider unavailable');
    const data = await response.json();
    if (data.base !== base || data.quote !== 'USD' || !Number.isFinite(data.rate) || data.rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw Error('Invalid exchange rate');
    return Response.json({ base, quote: 'USD', rate: data.rate, date: data.date, source: 'Frankfurter' }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' } });
  } catch {
    return Response.json({ error: 'USD conversion is temporarily unavailable. Please retry.' }, { status: 502, headers });
  }
}

export default httpHandler(handle);
