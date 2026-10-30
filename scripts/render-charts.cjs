const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createCanvas } = require('@napi-rs/canvas');
const Chart = require('../vendor/chart.umd.min.js');
const configure = require('../chart-options.js');
const core = require('../core.js');
const source = require('../samples/uci-retail.json');
globalThis.ForecastIQCurrency = source.currency;
const output = path.resolve(__dirname, '../.runtime/qa/chart-renders');
fs.mkdirSync(output, { recursive: true });
const observed = source.rows.slice(-45), projected = core.forecast(source.rows, 30, 'seasonal');
const series = {
  labels: [...observed.map(row => row.date), ...projected.map(row => row.date)],
  datasets: [
    { label: 'Observed sales', data: [...observed.map(row => row.sales), ...projected.map(() => null)], fill: true },
    { label: '30-day forecast', data: [...observed.slice(1).map(() => null), observed.at(-1).sales, ...projected.map(row => row.sales)] }
  ]
};
const countries = source.countryTotals.slice(0, 5);
countries.push({ name: 'Other destinations', sales: source.countryTotals.slice(5).reduce((sum, row) => sum + Math.round(row.sales * 100), 0) / 100 });
for (const width of [360, 900]) {
  for (const type of ['line', 'doughnut']) {
    const height = 320;
    const canvas = createCanvas(width, height);
    const data = type === 'line' ? series : { labels: countries.map(row => row.name), datasets: [{ data: countries.map(row => row.sales) }] };
    const config = configure(type === 'line' ? 'salesChart' : 'categoryChart', type, data);
    config.options.responsive = false;
    config.options.animation = false;
    config.options.devicePixelRatio = 1;
    config.plugins.push({ id: 'previewBackground', beforeDraw(chart) { chart.ctx.save(); chart.ctx.fillStyle = '#fff'; chart.ctx.fillRect(0, 0, width, height); chart.ctx.restore(); } });
    const chart = new Chart(canvas, config);
    assert.ok(chart.chartArea.width > 200, `${type} plot should fit at ${width}px`);
    assert.ok(chart.chartArea.height > 150, `${type} legend should leave usable chart height`);
    if (type === 'line') {
      assert.equal(chart.scales.y.min, 0, 'Non-negative sales should have a zero baseline');
      assert.equal(chart.config.data.datasets[0].data[44], observed.at(-1).sales);
      assert.equal(chart.config.data.datasets[1].data[45], projected[0].sales);
    }
    fs.writeFileSync(path.join(output, `${type}-${width}.png`), canvas.toBuffer('image/png'));
    chart.destroy();
  }
}
console.log(`Rendered actual Chart.js charts at 360px and 900px: ${output}`);
