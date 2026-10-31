import assert from 'node:assert/strict';
import marketHandler from '../api/market.mjs';
import indicesHandler from '../api/indices.mjs';
import { validateMarketRequest } from '../lib/market-data.mjs';
import { httpHandler } from '../lib/http-handler.mjs';
import exchangeRate from '../api/exchange-rate.mjs';

assert.equal(validateMarketRequest('RELIANCE.NS', '^NSEI', '1y'), true);
assert.equal(validateMarketRequest('INVALID!', '^NSEI', '1y'), false);

const invalid = await marketHandler(new Request('https://forecastiq.example/api/market?symbol=INVALID!'));
assert.equal(invalid.status, 400);
assert.match((await invalid.json()).error, /Invalid symbol/i);

const wrongMarketMethod = await marketHandler(new Request('https://forecastiq.example/api/market', { method: 'POST' }));
assert.equal(wrongMarketMethod.status, 405);

const wrongIndicesMethod = await indicesHandler(new Request('https://forecastiq.example/api/indices', { method: 'POST' }));
assert.equal(wrongIndicesMethod.status, 405);

// Vercel's default Node handler supplies a relative URL and expects res.end().
// Testing only Web Requests concealed the production Invalid URL crash.
async function invokeNode(handler, url, method = 'GET') {
  const headers = {};
  let body;
  const response = {
    statusCode: 200,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(value) { body = String(value); }
  };
  await handler({ url, method }, response);
  assert.match(headers['content-type'], /application\/json/);
  return { status: response.statusCode, headers, payload: JSON.parse(body) };
}

assert.equal((await invokeNode(marketHandler, '/api/market?symbol=INVALID!')).status, 400);
assert.equal((await invokeNode(indicesHandler, '/api/indices', 'POST')).status, 405);
const failure = await invokeNode(httpHandler(() => { throw Error('test crash'); }), '/api/test');
assert.equal(failure.status, 500);
assert.equal(failure.headers['cache-control'], 'no-store');

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => Response.json({ chart: { result: [{
  meta: { longName: 'Provider fixture', currency: 'INR', regularMarketPrice: 150 },
  timestamp: Array.from({ length: 25 }, (_, i) => 1735689600 + i * 86400),
  indicators: { quote: [{ close: Array.from({ length: 25 }, (_, i) => 100 + i) }] }
}] } });
try {
  const market = await invokeNode(marketHandler, '/api/market?symbol=RELIANCE.NS&benchmark=%5ENSEI&range=1y');
  assert.equal(market.status, 200);
  assert.equal(market.payload.data.length, 25);
  assert.equal(market.payload.stockName, 'Provider fixture');
  assert.equal(market.payload.quote.price, 150, 'Use the current provider quote rather than the historical series close');
  assert.equal((await invokeNode(indicesHandler, '/api/indices')).payload.indices.length, 4);
  globalThis.fetch = async () => { throw Error('Provider offline'); };
  const offline = await invokeNode(marketHandler, '/api/market?symbol=TCS.NS');
  assert.equal(offline.status, 502);
  assert.match(offline.payload.error, /Provider offline/);
} finally { globalThis.fetch = originalFetch; }

assert.equal((await invokeNode(exchangeRate, '/api/exchange-rate?base=BAD')).status, 400);
assert.equal((await invokeNode(exchangeRate, '/api/exchange-rate', 'POST')).status, 405);
assert.equal((await invokeNode(exchangeRate, '/api/exchange-rate?base=USD')).payload.rate, 1);
try {
  globalThis.fetch = async () => Response.json({ base: 'GBP', quote: 'USD', rate: 1.25, date: '2026-10-30' });
  const converted = await invokeNode(exchangeRate, '/api/exchange-rate?base=GBP');
  assert.equal(converted.status, 200);
  assert.equal(converted.payload.rate, 1.25);
  globalThis.fetch = async () => Response.json({ base: 'GBP', quote: 'USD', rate: -1, date: 'invalid' });
  assert.equal((await invokeNode(exchangeRate, '/api/exchange-rate?base=GBP')).status, 502);
  globalThis.fetch = async () => { throw Error('Network unavailable'); };
  assert.equal((await invokeNode(exchangeRate, '/api/exchange-rate?base=GBP')).status, 502);
} finally { globalThis.fetch = originalFetch; }

console.log('Vercel Node and Web handlers: validation, success, provider errors and JSON crash responses passed.');
