const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'http://localhost:8765',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const w = dom.window;
const context = dom.getInternalVMContext();
const read = expression => vm.runInContext(expression, context);
const stateStyles = w.document.createElement('style');
stateStyles.textContent = fs.readFileSync(path.join(root, 'navigation.css'), 'utf8');
w.document.head.append(stateStyles);
const errors = [];
const requests = [];
let providerState = 'success';
let fixture;

w.addEventListener('error', event => errors.push(event.error));
w.Chart = class {
  constructor(canvas, config) { this.canvas = canvas; this.config = config; }
  destroy() {}
  resize() {}
};
w.scrollTo = () => {};
w.print = () => {};
w.fetch = async url => {
  requests.push(String(url));
  if (String(url).startsWith('/api/exchange-rate')) return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ base: new URL(url, 'http://localhost').searchParams.get('base'), quote: 'USD', rate: 1.25, date: '2026-10-30' }) };
  if (url === '/api/indices') return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ indices: [] }) };
  assert.match(String(url), /^\/api\/market\?/);
  if (providerState === 'failure') throw new Error('Test provider unavailable');
  if (providerState === 'static-server') return { ok: false, status: 404, headers: { get: () => 'text/html' } };
  if (providerState === 'server-crash') return { ok: false, status: 500, headers: { get: () => 'text/plain' }, json: async () => { throw new SyntaxError('Unexpected token A'); } };
  if (providerState === 'invalid-json') return { ok: false, status: 502, headers: { get: () => 'application/json' }, json: async () => { throw new SyntaxError('Unexpected token A'); } };
  assert.ok(fixture, 'A test fixture must be configured before market requests');
  return { ok: true, headers: { get: () => 'application/json' }, json: async () => fixture };
};

async function main() {
  try {
    for (const name of ['core.js', 'graph-data.js', 'samples/uci-retail.js', 'chart-options.js', 'overview-currency.js', 'app.js', 'auth.js', 'enhancements.js', 'market-ui.js', 'forecast-studio.js', 'premium.js', 'navigation.js', 'market-data-state.js', 'graph-enhancements.js']) {
      vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { filename: name });
    }
    const workspace = w.document.getElementById('stocks');
    const state = () => w.document.getElementById('quoteMarketState').textContent;
    const menu = w.document.getElementById('workspaceNavigation');

    assert.equal(workspace.classList.contains('market-awaiting-data'), true);
    assert.equal(w.getComputedStyle(w.document.getElementById('stockChart')).visibility, 'hidden');
    assert.equal(w.getComputedStyle(w.document.getElementById('stockMetrics')).visibility, 'hidden');
    assert.equal(read('currentMarketPayload'), null);
    assert.equal(state(), 'AWAITING DATA');
    assert.equal(w.document.getElementById('marketMeta').textContent, 'No market history loaded');
    assert.equal(requests.filter(url => url.startsWith('/api/market')).length, 0);

    // Deterministic synthetic values are used only as an explicitly named test fixture.
    // No request leaves this JSDOM instance.
    const data = read('ForecastIQCore.sampleStocks()');
    fixture = {
      symbol: 'RELIANCE.NS', benchmark: '^NSEI',
      stockName: 'Test fixture company (not market data)',
      currency: 'INR', exchange: 'Test exchange', marketState: 'CLOSED',
      timezone: 'Asia/Kolkata', fetchedAt: '2026-10-30T12:00:00Z', data,
      quote: { price: data.at(-1).stock, previousClose: data.at(-2).stock,
        changePercent: (data.at(-1).stock / data.at(-2).stock - 1) * 100,
        dayLow: data.at(-1).stock - 5, dayHigh: data.at(-1).stock + 5, volume: 10000 }
    };

    const pending = read('fetchMarketData()');
    assert.equal(workspace.classList.contains('market-awaiting-data'), true);
    assert.equal(state(), 'LOADING');
    assert.equal(read('currentMarketPayload'), null);
    await pending;
    assert.equal(workspace.classList.contains('market-awaiting-data'), false);
    assert.notEqual(w.getComputedStyle(w.document.getElementById('stockChart')).visibility, 'hidden');
    assert.equal(state(), 'CLOSED');
    assert.equal(read('currentMarketPayload.stockName'), fixture.stockName);
    assert.equal(w.document.getElementById('quoteCompany').textContent, fixture.stockName);
    assert.match(w.document.getElementById('quoteTimestamp').textContent, /latest session/);
    assert.match(w.document.getElementById('marketStatus').textContent, /real trading sessions/);
    assert.equal(read('charts.stockChart.config.data.datasets[0].data.at(-1)'), data.at(-1).stock / data[0].stock * 100);
    assert.equal(w.document.getElementById('fetchMarketBtn').disabled, false);
    assert.equal(read('charts.stockDrawdownChart.config.data.datasets[0].data[0]'), 0);
    assert.ok(read('charts.stockDrawdownChart.config.data.datasets[0].data.every(value=>value<=0)'));
    const chartView = w.document.getElementById('stockChartView');
    chartView.value = 'return'; chartView.dispatchEvent(new w.Event('change'));
    assert.equal(read('charts.stockChart.config.data.datasets[0].data[0]'), 0);
    assert.match(read("charts.stockChart.config.options.plugins.tooltip.callbacks.label({dataset:{label:'Stock'},parsed:{y:5}})"), /5.00%/);
    chartView.value = 'price'; chartView.dispatchEvent(new w.Event('change'));
    assert.equal(read('charts.stockChart.config.data.datasets.length'), 1);
    assert.equal(read('charts.stockChart.config.data.datasets[0].data.at(-1)'), data.at(-1).stock);
    assert.match(read("charts.stockChart.config.options.plugins.tooltip.callbacks.label({dataset:{label:'Stock'},parsed:{y:100}})"), /₹/);
    chartView.value = 'indexed'; chartView.dispatchEvent(new w.Event('change'));

    // A provider error must conceal the previous prices and clear verified metadata.
    providerState = 'failure';
    await read('fetchMarketData()');
    assert.equal(workspace.classList.contains('market-awaiting-data'), true);
    assert.equal(w.getComputedStyle(w.document.getElementById('stockChart')).visibility, 'hidden');
    assert.equal(w.getComputedStyle(w.document.getElementById('stockMetrics')).visibility, 'hidden');
    assert.equal(read('currentMarketPayload'), null);
    assert.equal(state(), 'UNAVAILABLE');
    assert.equal(w.document.getElementById('quoteCompany').textContent, 'Market data unavailable');
    assert.equal(w.document.getElementById('quoteTimestamp').textContent, 'No verified response');
    assert.match(w.document.getElementById('marketMeta').textContent, /No simulated prices/);
    assert.match(w.document.getElementById('marketStatus').textContent, /Test provider unavailable/);
    assert.equal(w.document.getElementById('fetchMarketBtn').disabled, false);

    // Retry through the same public function restores the verified chart state.
    providerState = 'success';
    await read('fetchMarketData()');
    assert.equal(workspace.classList.contains('market-awaiting-data'), false);
    assert.notEqual(w.getComputedStyle(w.document.getElementById('stockChart')).visibility, 'hidden');
    assert.equal(read('currentMarketPayload.symbol'), fixture.symbol);
    assert.equal(state(), 'CLOSED');
    assert.equal(requests.filter(url => url.startsWith('/api/market')).length, 3);

    for (const failure of ['server-crash', 'invalid-json']) {
      providerState = failure;
      await read('fetchMarketData()');
      assert.equal(state(), 'UNAVAILABLE');
      assert.match(w.document.getElementById('marketStatus').textContent, /Market service returned HTTP/);
      assert.doesNotMatch(w.document.getElementById('marketStatus').textContent, /Unexpected token/);
      assert.equal(w.document.getElementById('fetchMarketBtn').disabled, false);
    }
    providerState = 'success';

    // Files exported by this app must be accepted by the upload parser.
    providerState = 'static-server';
    await read('fetchMarketData()');
    assert.equal(state(), 'UNAVAILABLE');
    assert.match(w.document.getElementById('marketStatus').textContent, /START_FORECASTIQ\.bat/);
    assert.match(w.document.getElementById('marketStatus').textContent, /http:\/\/localhost:8765/);
    assert.equal(w.document.getElementById('fetchMarketBtn').disabled, false);
    providerState = 'success';

    const exported = ['date,stock_close,benchmark_close', ...data.map(row => `${row.date},${row.stock},${row.benchmark}`)].join('\n');
    assert.equal(read(`parseStockCSV(${JSON.stringify(exported)}).length`), data.length);

    // Upload opens the chart and remains selected when returning to Stocks.
    w.document.querySelector('[data-market-tab="upload"]').click();
    const uploaded = new w.File([exported], 'comparison.csv', { type: 'text/csv' });
    w.uploadFixture = uploaded;
    const finishedUpload = new Promise(resolve => {
      const observer = new w.MutationObserver(() => {
        if (state() === 'UPLOADED') { observer.disconnect(); resolve(); }
      });
      observer.observe(w.document.getElementById('quoteMarketState'), { childList: true });
    });
    read('loadStockFile(uploadFixture)');
    await finishedUpload;
    assert.equal(workspace.classList.contains('market-awaiting-data'), false);
    assert.equal(w.document.getElementById('marketOverview').classList.contains('active'), true);
    assert.equal(read('currentMarketPayload'), null);
    assert.equal(read('stockData.length'), data.length);
    assert.equal(read('charts.stockDrawdownChart.config.data.datasets[0].label'), 'Uploaded stock');
    assert.notEqual(w.document.getElementById('quotePrice').textContent, '—');
    w.document.querySelector('.nav[data-view="stocks"]').click();
    assert.equal(state(), 'UPLOADED');
    assert.equal(requests.filter(url => url.startsWith('/api/market')).length, 6);
    assert.equal(w.document.getElementById('fetchMarketBtn').disabled, false);

    assert.equal(menu.hidden, false);
    assert.equal(menu.closest('.workspace-bar') !== null, true);
    w.document.getElementById('pageTitle').click();
    assert.equal(menu.hidden, false, 'Top navigation remains visible during content interaction');
    w.document.querySelector('.nav[data-view="report"]').click();
    assert.equal(menu.hidden, false, 'Page selection leaves top navigation visible');
    assert.equal(w.document.getElementById('report').classList.contains('active'), true);
    assert.equal(w.document.querySelector('.nav[data-view="report"]').getAttribute('aria-current'), 'page');

    // Selecting TCS while the initial company is loading must not lose the search.
    const normalFetch = w.fetch;
    let releaseFirst;
    const firstResponse = new Promise(resolve => { releaseFirst = resolve; });
    let firstMarket = true;
    w.fetch = async url => {
      if (!String(url).startsWith('/api/market?')) return normalFetch(url);
      if (firstMarket) { firstMarket = false; await firstResponse; }
      const symbol = new URL(url, 'http://localhost').searchParams.get('symbol');
      return { ok: true, headers: { get: () => 'application/json' }, json: async () => ({ ...fixture, symbol, stockName: symbol === 'TCS.NS' ? 'Tata Consultancy Services Limited' : fixture.stockName }) };
    };
    w.document.getElementById('stockSymbol').value = 'RELIANCE';
    const initialSearch = read('fetchMarketData()');
    w.document.querySelector('[data-stock="TCS"]').click();
    releaseFirst();
    await initialSearch;
    assert.equal(read('currentMarketPayload.symbol'), 'TCS.NS');
    assert.equal(w.document.getElementById('stockSymbol').value, 'TCS');
    assert.equal(w.document.getElementById('quoteCompany').textContent, 'Tata Consultancy Services Limited');
    assert.equal(workspace.classList.contains('market-awaiting-data'), false);
    assert.equal(w.document.getElementById('stockSearchResults').classList.contains('open'), false);
    w.fetch = normalFetch;
    assert.deepEqual(errors, []);
    console.log('Market awaiting, loading, provider success, failure, recovery and navigation checks passed.');
  } finally {
    w.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
