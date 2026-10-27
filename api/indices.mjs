import { jsonResponse, yahooChart } from './_market-data.mjs';

const indices = [
  ['^NSEI', 'NIFTY 50'],
  ['^BSESN', 'SENSEX'],
  ['^NSEBANK', 'NIFTY BANK'],
  ['^CNXIT', 'NIFTY IT']
];

export default async function handler(request) {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const items = await Promise.all(indices.map(async ([symbol, name]) => {
      const result = await yahooChart(symbol, '1mo');
      const values = [...result.points.values()];
      const price = values.at(-1);
      const previous = values.at(-2) ?? price;
      return { symbol, name, price, changePercent: previous ? (price / previous - 1) * 100 : null };
    }));
    return jsonResponse({ fetchedAt: new Date().toISOString(), indices: items }, 200, true);
  } catch (error) {
    return jsonResponse({ error: `Unable to retrieve index data: ${error.message}` }, 502);
  }
}
