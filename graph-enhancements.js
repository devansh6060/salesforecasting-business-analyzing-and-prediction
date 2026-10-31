(function () {
  'use strict';
  const data = ForecastIQGraphData;
  let salesWindow = 45, showAverage = true, stockView = 'indexed';
  globalThis.ForecastIQSalesWindow = salesWindow;
  const salesTools = document.createElement('div'); salesTools.className = 'graph-tools';
  salesTools.innerHTML = '<div class="graph-segments" role="group" aria-label="Sales history window"><button data-sales-window="45" aria-pressed="true">45 days</button><button data-sales-window="90" aria-pressed="false">90 days</button><button data-sales-window="180" aria-pressed="false">180 days</button></div><label><input id="salesAverageToggle" type="checkbox" checked>7-day average</label>';
  document.querySelector('#salesChart').before(salesTools);
  const stockTools = document.createElement('div'); stockTools.className = 'graph-tools';
  stockTools.innerHTML = '<label>Chart view<select id="stockChartView"><option value="indexed">Indexed comparison</option><option value="return">Cumulative return %</option><option value="price">Stock closing price</option></select></label><span class="graph-badge">Daily sessions</span>';
  document.querySelector('#stockChart').before(stockTools);
  const summary = document.createElement('div'); summary.id = 'stockGraphSummary'; summary.className = 'graph-summary';
  document.querySelector('#stockChart').after(summary);
  const baseChart = chart;
  chart = function (id, type, values, options = {}) {
    if (id === 'salesChart') {
      const history = rows.slice(-salesWindow), projected = metrics().f;
      const observed = history.map(row => row.sales);
      values = { labels: [...history.map(row => row.date), ...projected.map(row => row.date)], datasets: [
        { ...values.datasets[0], data: [...observed, ...projected.map(() => null)] },
        { ...values.datasets[1], data: [...history.slice(1).map(() => null), history.at(-1).sales, ...projected.map(row => row.sales)] },
        ...(showAverage ? [{ label: '7-day average', data: [...data.movingAverage(observed), ...projected.map(() => null)], borderColor: '#b08a45', borderDash: [2, 3] }] : [])
      ] };
    }
    baseChart(id, type, values, options);
    const descriptions = {
      monthlySalesChart: 'Observed sales by calendar month, converted to USD.',
      weekdaySalesChart: 'Average observed daily sales by weekday, converted to USD.',
      stockDrawdownChart: 'Stock and benchmark drawdown from the highest previously loaded close, in percent.',
      stockMonthlyReturnsChart: 'Stock and benchmark close-to-close monthly returns, in percent.'
    };
    if (descriptions[id]) document.getElementById(id).setAttribute('aria-label', descriptions[id]);
  };
  function overviewCharts() {
    const monthly = data.monthlySales(rows), weekdays = data.weekdaySales(rows);
    chart('monthlySalesChart', 'bar', { labels: monthly.labels, datasets: [{ label: 'Observed monthly sales', data: monthly.values }] }, { axisTitle: 'Monthly sales (USD)', plugins: { legend: { display: false } } });
    chart('weekdaySalesChart', 'bar', { labels: weekdays.labels, datasets: [{ label: 'Average daily sales', data: weekdays.values, backgroundColor: '#668bb2b0' }] }, { axisTitle: 'Average daily sales (USD)', plugins: { legend: { display: false } } });
    const caption = document.querySelector('#salesChart').parentElement.querySelector('.chart-caption');
    if (caption) caption.textContent = caption.textContent.replace(/Latest \d+ observed days/, `Latest ${Math.min(salesWindow, rows.length)} observed days`);
  }
  const baseRender = render;
  render = function () { baseRender(); overviewCharts(); };
  function stockCharts() {
    if (!stockData.length || document.getElementById('stocks').classList.contains('market-awaiting-data')) { summary.replaceChildren(); return; }
    const stockName = currentMarketPayload?.symbol || (quoteMarketState.textContent === 'UPLOADED' ? 'Uploaded stock' : stockSymbol.value);
    const benchmarkName = currentMarketPayload?.benchmark || (quoteMarketState.textContent === 'UPLOADED' ? 'Uploaded benchmark' : benchmarkSymbol.selectedOptions[0].textContent.replace('vs ', ''));
    const first = stockData[0];
    const indexed = stockView === 'indexed', price = stockView === 'price';
    const datasets = [{ label: stockName, data: stockData.map(row => price ? row.stock : (row.stock / first.stock - (indexed ? 0 : 1)) * 100), fill: price }];
    if (!price) datasets.push({ label: benchmarkName, data: stockData.map(row => (row.benchmark / first.benchmark - (indexed ? 0 : 1)) * 100) });
    chart('stockChart', 'line', { labels: stockData.map(row => row.date), datasets }, { valueFormat: price ? 'currency' : indexed ? 'indexed' : 'percent', currency: currentMarketPayload?.currency || 'INR', axisTitle: price ? 'Closing price (' + (currentMarketPayload?.currency || 'INR') + ')' : indexed ? 'Indexed performance | first session = 100' : 'Return since first loaded session (%)' });
    const stats = stockStats(stockData);
    summary.replaceChildren();
    for (const [label, value, suffix] of [['Stock return', stats.ret, '%'], ['Benchmark', stats.bench, '%'], ['Relative return', stats.alpha, ' pts']]) {
      const item = document.createElement('span'), number = document.createElement('strong');
      item.textContent = label; number.textContent = (value >= 0 ? '+' : '') + value.toFixed(2) + suffix;
      number.className = value >= 0 ? 'positive' : 'negative'; item.append(number); summary.append(item);
    }
    chart('stockDrawdownChart', 'line', { labels: stockData.map(row => row.date), datasets: [
      { label: stockName, data: data.drawdowns(stockData, 'stock'), borderColor: '#b06464', backgroundColor: '#b0646418', fill: true },
      { label: benchmarkName, data: data.drawdowns(stockData, 'benchmark'), borderColor: '#668bb2' }
    ] }, { axisTitle: 'Drawdown from loaded peak (%)' });
    const monthly = data.monthlyReturns(stockData);
    chart('stockMonthlyReturnsChart', 'bar', { labels: monthly.labels, datasets: [{ label: stockName, data: monthly.stock }, { label: benchmarkName, data: monthly.benchmark }] }, { axisTitle: 'Monthly return (%)' });
  }
  const baseStocks = renderStocks;
  renderStocks = function () { baseStocks(); stockCharts(); };
  salesTools.querySelectorAll('[data-sales-window]').forEach(button => button.onclick = () => {
    salesWindow = Number(button.dataset.salesWindow);
    globalThis.ForecastIQSalesWindow = salesWindow;
    salesTools.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    render();
  });
  document.getElementById('salesAverageToggle').onchange = event => { showAverage = event.target.checked; render(); };
  document.getElementById('stockChartView').onchange = event => { stockView = event.target.value; stockCharts(); };
  document.querySelectorAll('[data-market-tab]').forEach(button => button.addEventListener('click', () => requestAnimationFrame(() => { charts.stockDrawdownChart?.resize?.(); charts.stockMonthlyReturnsChart?.resize?.(); charts.stockChart?.resize?.(); })));
  render(); stockCharts();
})();
