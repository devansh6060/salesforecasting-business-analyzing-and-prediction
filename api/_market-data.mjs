const ALLOWED_RANGES = new Set(['1mo', '3mo', '6mo', '1y', '2y', '5y']);
const SYMBOL_PATTERN = /^[A-Z0-9^&.-]{1,24}$/;

export function validateMarketRequest(symbol, benchmark, period) {
  return SYMBOL_PATTERN.test(symbol) && SYMBOL_PATTERN.test(benchmark) && ALLOWED_RANGES.has(period);
}

function lastNumber(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] != null && Number.isFinite(Number(values[index]))) return Number(values[index]);
  }
  return null;
}

function isoDateFromUnix(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

export async function yahooChart(symbol, period) {
  const endpoint = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  endpoint.searchParams.set('range', period);
  endpoint.searchParams.set('interval', '1d');
  endpoint.searchParams.set('events', 'div,splits');

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 ForecastIQ-Academic/1.0'
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Market provider returned HTTP ${response.status}`);

  const payload = await response.json();
  const result = payload?.chart?.result;
  const providerError = payload?.chart?.error;
  if (providerError || !result?.length) {
    throw new Error(providerError?.description || `No market history was found for ${symbol}`);
  }

  const item = result[0];
  const timestamps = item.timestamp || [];
  const indicators = item.indicators || {};
  const quote = indicators.quote?.[0] || {};
  const prices = indicators.adjclose?.[0]?.adjclose || quote.close || [];
  const points = new Map();
  timestamps.forEach((timestamp, index) => {
    const price = prices[index];
    if (price != null && Number.isFinite(Number(price))) points.set(isoDateFromUnix(timestamp), Number(Number(price).toFixed(4)));
  });
  if (points.size < 2) throw new Error(`Insufficient price history for ${symbol}`);

  return {
    meta: item.meta || {},
    points,
    last: {
      close: lastNumber(quote.close),
      open: lastNumber(quote.open),
      high: lastNumber(quote.high),
      low: lastNumber(quote.low),
      volume: lastNumber(quote.volume)
    }
  };
}

export async function marketPayload(symbol, benchmark, period) {
  const [stock, market] = await Promise.all([yahooChart(symbol, period), yahooChart(benchmark, period)]);
  const commonDates = [...stock.points.keys()].filter(date => market.points.has(date)).sort();
  const data = commonDates.map(date => ({ date, stock: stock.points.get(date), benchmark: market.points.get(date) }));
  if (data.length < 20) throw new Error('Fewer than 20 matching trading sessions were returned');

  const meta = stock.meta;
  const previous = data.at(-2)?.stock ?? meta.previousClose ?? null;
  const current = stock.last.close ?? meta.regularMarketPrice ?? data.at(-1).stock;
  return {
    symbol,
    benchmark,
    stockName: meta.longName || meta.shortName || symbol,
    currency: meta.currency || 'INR',
    exchange: meta.fullExchangeName || meta.exchangeName || 'India',
    marketState: meta.marketState || 'CLOSED',
    timezone: meta.exchangeTimezoneName || 'Asia/Kolkata',
    quote: {
      price: current,
      previousClose: previous,
      changePercent: previous ? (current / previous - 1) * 100 : null,
      dayHigh: stock.last.high,
      dayLow: stock.last.low,
      volume: stock.last.volume
    },
    fetchedAt: new Date().toISOString(),
    data
  };
}

export function jsonResponse(payload, status = 200, cache = false) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': cache ? 'public, s-maxage=300, stale-while-revalidate=600' : 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
