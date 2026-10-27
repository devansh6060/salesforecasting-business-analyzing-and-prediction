import assert from 'node:assert/strict';
import marketHandler from '../api/market.mjs';
import indicesHandler from '../api/indices.mjs';
import { validateMarketRequest } from '../api/_market-data.mjs';

assert.equal(validateMarketRequest('RELIANCE.NS', '^NSEI', '1y'), true);
assert.equal(validateMarketRequest('INVALID!', '^NSEI', '1y'), false);

const invalid = await marketHandler(new Request('https://forecastiq.example/api/market?symbol=INVALID!'));
assert.equal(invalid.status, 400);
assert.match((await invalid.json()).error, /Invalid symbol/i);

const wrongMarketMethod = await marketHandler(new Request('https://forecastiq.example/api/market', { method: 'POST' }));
assert.equal(wrongMarketMethod.status, 405);

const wrongIndicesMethod = await indicesHandler(new Request('https://forecastiq.example/api/indices', { method: 'POST' }));
assert.equal(wrongIndicesMethod.status, 405);

console.log('5 Vercel configuration and serverless-function checks passed.');
