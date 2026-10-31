const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createCanvas } = require('@napi-rs/canvas');
const Chart = require('../vendor/chart.umd.min.js');
const configure = require('../chart-options.js');
const graph = require('../graph-data.js');
const source = require('../samples/uci-retail.json');
const core = require('../core.js');
// Deterministic QA fixtures, not current exchange rates or market observations.
globalThis.ForecastIQCurrency = 'GBP';
globalThis.ForecastIQOverviewCurrency = { convert: value => value * 1.25 };
const stocks = core.sampleStocks();
const monthly = graph.monthlySales(source.rows), weekdays = graph.weekdaySales(source.rows), returns = graph.monthlyReturns(stocks);
const observed = source.rows.slice(-45), future = core.forecast(source.rows, 30, 'seasonal');
const cases = [
  ['salesChart', 'line', { labels: [...observed.map(r => r.date), ...future.map(r => r.date)], datasets: [
    { label: 'Observed sales', data: [...observed.map(r => r.sales), ...future.map(() => null)], fill: true },
    { label: '30-day forecast', data: [...observed.slice(1).map(() => null), observed.at(-1).sales, ...future.map(r => r.sales)] },
    { label: '7-day average', data: [...graph.movingAverage(observed.map(r => r.sales)), ...future.map(() => null)], borderColor: '#b08a45', borderDash: [2, 3] }
  ] }, {}],
  ['monthlySalesChart', 'bar', { labels: monthly.labels, datasets: [{ label: 'Observed monthly sales', data: monthly.values }] }, { axisTitle: 'Monthly sales (USD)', plugins: { legend: { display: false } } }],
  ['weekdaySalesChart', 'bar', { labels: weekdays.labels, datasets: [{ label: 'Average daily sales', data: weekdays.values, backgroundColor: '#668bb2b0' }] }, { axisTitle: 'Average daily sales (USD)', plugins: { legend: { display: false } } }],
  ['stockDrawdownChart', 'line', { labels: stocks.map(r => r.date), datasets: [
    { label: 'Stock', data: graph.drawdowns(stocks, 'stock'), borderColor: '#b06464', backgroundColor: '#b0646418', fill: true },
    { label: 'Benchmark', data: graph.drawdowns(stocks, 'benchmark') }
  ] }, { axisTitle: 'Drawdown from loaded peak (%)' }],
  ['stockMonthlyReturnsChart', 'bar', { labels: returns.labels, datasets: [{ label: 'Stock', data: returns.stock }, { label: 'Benchmark', data: returns.benchmark }] }, { axisTitle: 'Monthly return (%)' }],
  ['stockChart', 'line', { labels: stocks.map(r => r.date), datasets: [{ label: 'Stock closing price', data: stocks.map(r => r.stock), fill: true }] }, { valueFormat: 'currency', currency: 'INR', axisTitle: 'Closing price (INR)' }]
];
const output = path.resolve(__dirname, '../.runtime/qa/enhanced-charts');
fs.mkdirSync(output, { recursive: true });
for (const width of [360, 900]) for (const [id, type, data, options] of cases) {
  const height = ['salesChart', 'stockChart'].includes(id) ? 320 : width === 360 ? 250 : 270;
  const canvas = createCanvas(width, height);
  const config = configure(id, type, data, options);
  Object.assign(config.options, { responsive: false, animation: false, devicePixelRatio: 1 });
  config.plugins.push({ id: 'background', beforeDraw(chart) { chart.ctx.save(); chart.ctx.fillStyle = '#fff'; chart.ctx.fillRect(0, 0, width, height); chart.ctx.restore(); } });
  const chart = new Chart(canvas, config);
  assert.ok(chart.chartArea.width > 230 && chart.chartArea.height > 120, id + ' must fit at ' + width);
  assert.ok(chart.getDatasetMeta(0).data.length > 0);
  fs.writeFileSync(path.join(output, `${id}-${width}.png`), canvas.toBuffer('image/png'));
  chart.destroy();
}
console.log('Rendered six enhanced charts at mobile and desktop widths: ' + output);
