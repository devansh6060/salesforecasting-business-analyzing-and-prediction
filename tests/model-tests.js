'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../core.js');

let passed = 0;

function test(name, action) {
  action();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('linear regression identifies a rising series', () => {
  const result = core.regression([10, 20, 30, 40, 50]);
  assert(Math.abs(result.slope - 10) < 1e-9);
  assert(Math.abs(result.intercept - 10) < 1e-9);
});

test('linear regression identifies a flat series', () => {
  const result = core.regression([25, 25, 25, 25]);
  assert(Math.abs(result.slope) < 1e-9);
  assert(Math.abs(result.intercept - 25) < 1e-9);
});

test('UTC date arithmetic advances across month boundaries', () => {
  assert.strictEqual(core.addDaysISO('2026-07-31', 1), '2026-08-01');
  assert.strictEqual(core.addDaysISO('2028-02-28', 1), '2028-02-29');
});

test('the built-in data contain 180 unique calendar dates', () => {
  const data = core.sampleSales();
  assert.strictEqual(data.length, 180);
  assert.strictEqual(new Set(data.map(row => row.date)).size, 180);
  assert(data.every(row => row.sales >= 0 && core.isValidISODate(row.date)));
});

test('forecast dates begin after the final observed date', () => {
  const data = core.sampleSales();
  const result = core.forecast(data, 7, 'seasonal');
  assert.strictEqual(result.length, 7);
  assert.strictEqual(result[0].date, core.addDaysISO(data.at(-1).date, 1));
  assert.strictEqual(result.at(-1).date, core.addDaysISO(data.at(-1).date, 7));
});

test('forecast supports the 90-day UI horizon and non-negative values', () => {
  const result = core.forecast(core.sampleSales(), 90, 'linear');
  assert.strictEqual(result.length, 90);
  assert(result.every(row => row.sales >= 0));
});

test('moving average produces a flat baseline', () => {
  const result = core.forecast(core.sampleSales(), 30, 'moving');
  assert.strictEqual(new Set(result.map(row => row.sales)).size, 1);
});

test('chronological holdout evaluation is calendar-aligned', () => {
  const result = core.evaluateForecast(core.sampleSales(), 'seasonal', 30);
  assert(result.calendarAligned);
  assert.strictEqual(result.holdout, 30);
  assert(result.mae >= 0 && result.rmse >= 0 && result.mape >= 0);
});

test('sales parser supports quoted categories containing commas', () => {
  const text = 'date,sales,category\n2026-09-01,1250,"Food, Beverages"\n';
  const records = core.parseSalesCSV(text, 1);
  assert.deepStrictEqual(records[0], { date: '2026-09-01', sales: 1250, category: 'Food, Beverages' });
});

test('sales parser accepts the bundled sample CSV', () => {
  const text = fs.readFileSync(path.join(__dirname, '..', 'sample_sales.csv'), 'utf8');
  const records = core.parseSalesCSV(text, 1);
  assert(records.length > 0);
  assert(records.every(row => row.sales >= 0 && core.isValidISODate(row.date)));
});

test('sales parser rejects blank and negative sales', () => {
  assert.throws(() => core.parseSalesCSV('date,sales\n2026-09-01,\n', 1), /cannot be blank/);
  assert.throws(() => core.parseSalesCSV('date,sales\n2026-09-01,-5\n', 1), /cannot be negative/);
});

test('sales parser rejects invalid and duplicate dates', () => {
  assert.throws(() => core.parseSalesCSV('date,sales\nnot-a-date,10\n', 1), /real YYYY-MM-DD/);
  assert.throws(
    () => core.parseSalesCSV('date,sales\n2026-09-01,10\n2026-09-01,20\n', 1),
    /duplicate date/
  );
});

test('sales parser enforces minimum history', () => {
  assert.throws(() => core.parseSalesCSV('date,sales\n2026-09-01,10\n'), /At least 14/);
});

test('market parser validates positive synchronized history', () => {
  const rows = ['date,stock,benchmark'];
  let date = '2026-01-01';
  for (let index = 0; index < 20; index += 1) {
    rows.push(`${date},${100 + index},${200 + index}`);
    date = core.addDaysISO(date, 1);
  }
  const parsed = core.parseStockCSV(rows.join('\n'));
  assert.strictEqual(parsed.length, 20);
  assert.throws(() => core.parseStockCSV('date,stock,benchmark\n2026-01-01,0,100', 1), /positive numbers/);
});

console.log(`\n${passed} automated model and validation tests passed.`);
