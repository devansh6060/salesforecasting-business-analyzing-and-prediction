const assert = require('node:assert/strict');
const data = require('../graph-data.js');
assert.deepEqual(data.movingAverage([1, 2, 3, 4], 3), [null, null, 2, 3]);
const rows = [
  { date: '2026-01-30', sales: 10, stock: 100, benchmark: 200 },
  { date: '2026-01-31', sales: 20, stock: 110, benchmark: 210 },
  { date: '2026-02-02', sales: 0, stock: 99, benchmark: 231 },
  { date: '2026-02-09', sales: 40, stock: 121, benchmark: 231 }
];
assert.deepEqual(data.monthlySales(rows).values, [30, 40]);
assert.deepEqual(data.monthlySales(rows).labels, ['Jan 26', 'Feb 26']);
assert.equal(data.weekdaySales(rows).values[0], 20, 'Include zero-sales Mondays in the weekday average');
assert.equal(data.weekdaySales(rows).values[1], null, 'Do not invent observations for missing weekdays');
assert.ok(Math.abs(data.drawdowns(rows, 'stock')[2] + 10) < 1e-9);
assert.equal(data.drawdowns(rows, 'stock')[3], 0);
const returns = data.monthlyReturns(rows);
assert.ok(Math.abs(returns.stock[0] - 10) < 1e-9);
assert.ok(Math.abs(returns.stock[1] - 10) < 1e-9);
assert.ok(Math.abs(returns.benchmark[1] - 10) < 1e-9);
assert.deepEqual(data.monthlyReturns(rows.slice(0, 1)).stock, []);
console.log('Rolling averages, monthly sums, weekday averages, drawdowns and monthly returns passed.');
