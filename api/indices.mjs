import { jsonResponse, yahooChart } from '../lib/market-data.mjs';
import { httpHandler } from '../lib/http-handler.mjs';

const indices = [
  ['^NSEI', 'NIFTY 50'],
  ['^BSESN', 'SENSEX'],
  ['^NSEBANK', 'NIFTY BANK'],
  ['^CNXIT', 'NIFTY IT']
];

async function handle(request) {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const items = await Promise.all(indices.map(async ([symbol, name]) => {
      const result = await yahooChart(symbol, '1mo');
      const values = [...result.points.values()];
      const price = result.meta.regularMarketPrice ?? result.last.close ?? values.at(-1);
      const previous = result.meta.previousClose ?? result.last.previousClose ?? price;
      return { symbol, name, price, changePercent: previous ? (price / previous - 1) * 100 : null };
    }));
    return jsonResponse({ fetchedAt: new Date().toISOString(), indices: items }, 200, true);
  } catch (error) {
    return jsonResponse({ error: `Unable to retrieve index data: ${error.message}` }, 502);
  }
}

export default httpHandler(handle);
