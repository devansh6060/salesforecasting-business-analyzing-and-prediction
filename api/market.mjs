import { jsonResponse, marketPayload, validateMarketRequest } from '../lib/market-data.mjs';
import { httpHandler } from '../lib/http-handler.mjs';

async function handle(request) {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') || '').trim().toUpperCase();
  const benchmark = (url.searchParams.get('benchmark') || '^NSEI').trim().toUpperCase();
  const period = (url.searchParams.get('range') || '1y').trim();
  if (!validateMarketRequest(symbol, benchmark, period)) {
    return jsonResponse({ error: 'Invalid symbol, benchmark or date range.' }, 400);
  }

  try {
    return jsonResponse(await marketPayload(symbol, benchmark, period), 200, true);
  } catch (error) {
    return jsonResponse({ error: `Unable to retrieve market data: ${error.message}` }, 502);
  }
}

export default httpHandler(handle);
