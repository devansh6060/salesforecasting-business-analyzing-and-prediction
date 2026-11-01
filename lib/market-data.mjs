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
  let payload;
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    const endpoint = new URL(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}`);
    endpoint.searchParams.set('range', period);
    endpoint.searchParams.set('interval', '1d');
    endpoint.searchParams.set('events', 'div,splits');
    let response;
    try {
      response = await fetch(endpoint, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 ForecastIQ-Academic/1.0' },
        signal: AbortSignal.timeout(7000)
      });
      if (!response.ok) throw new Error(`Market provider returned HTTP ${response.status}`);
      payload = await response.json();
      break;
    } catch (error) {
      // Retry temporary provider/network failures within the browser's 20s limit.
      if (response && response.status >= 400 && response.status < 500 && response.status !== 429) throw error;
      if (host === 'query1.finance.yahoo.com') continue;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new Error('Both market endpoints timed out. Please retry Search.');
      }
      if (error.message === 'fetch failed') {
        throw new Error('Cannot connect to Yahoo Finance. Check the server internet connection, VPN or firewall, then retry Search.');
      }
      throw error;
    }
  }
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
      previousClose: lastNumber((quote.close || []).slice(0, -1)),
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
  if (data.length < 2) throw new Error('Fewer than two matching trading sessions were returned');

  const meta = stock.meta;
  const previous = meta.previousClose ?? stock.last.previousClose ?? null;
  const current = meta.regularMarketPrice ?? stock.last.close ?? data.at(-1).stock;
  return {
    symbol,
    benchmark,
    stockName: meta.longName || meta.shortName || symbol,
    currency: meta.currency || 'INR',
    exchange: meta.fullExchangeName || meta.exchangeName || 'India',
    marketState: meta.marketState || 'DELAYED',
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
      'Cache-Control': cache ? 'public, max-age=0, s-maxage=60' : 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
