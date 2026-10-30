(function () {
  'use strict';
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    forecast: '<path d="M3 17l6-6 4 3 8-10M15 4h6v6M3 21h18"/>',
    data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    stocks: '<path d="M5 3v18M12 3v18M19 3v18"/><rect x="3" y="7" width="4" height="7" rx="1"/><rect x="10" y="5" width="4" height="5" rx="1"/><rect x="17" y="11" width="4" height="6" rx="1"/>',
    report: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>',
    businessDetail: '<path d="M4 21V7h16v14M8 7V3h8v4M2 21h20M8 11h2M14 11h2M8 15h2M14 15h2"/>'
  };
  document.querySelectorAll('.nav').forEach(button => {
    button.querySelector('.nav-symbol').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[button.dataset.view]}</svg>`;
  });
  document.querySelector('.professional-hero h2').textContent = 'Your next move, informed by data.';
  document.querySelector('.professional-hero .sub').textContent = 'Track revenue, review the demand outlook, and turn your sales history into a practical plan.';
  document.querySelector('.hero-kicker>span').textContent = 'PERFORMANCE OUTLOOK';
  document.querySelector('.score-heading>span').textContent = 'HOLDOUT ERROR';
  document.querySelector('.confidence-ring small').textContent = '% MAPE';
  document.querySelector('.score-copy strong').textContent = 'Measured on unseen history';
  document.querySelector('.score-copy p').textContent = 'Lower error is better. This is a historical backtest, not a guarantee.';
  document.querySelector('.score-factors div:nth-child(2) span').textContent = 'Model fit';
  const chartRow = document.querySelector('#dashboard > .grid.two');
  chartRow.classList.add('premium-chart-row');
  document.querySelector('#dashboard .kpis').after(chartRow);
  document.querySelector('#salesChart').parentElement.querySelector('h3').textContent = 'Revenue & demand outlook';
  const caption = document.createElement('p');
  caption.className = 'chart-caption';
  document.querySelector('#salesChart').parentElement.append(caption);
  const categoryCaption = document.createElement('p');
  categoryCaption.className = 'chart-caption';
  categoryCaption.textContent = 'Share of revenue across the full selected history. View exact records in Data manager.';
  document.querySelector('#categoryChart').parentElement.append(categoryCaption);
  const publicData = globalThis.ForecastIQPublicData;
  let source = 'demo';
  let uploadedName = '';
  globalThis.ForecastIQCurrency = 'INR';
  const currencySelect = document.getElementById('salesCurrency');
  const datasetContext = document.createElement('div');
  datasetContext.className = 'dataset-context';
  datasetContext.setAttribute('role', 'status');
  document.querySelector('.app-header').after(datasetContext);
  const publicOption = document.createElement('option');
  publicOption.value = 'uci'; publicOption.textContent = 'UCI Online Retail · real history';
  businessSelector.prepend(publicOption);
  [...businessSelector.options].filter(option => option.value !== 'uci').forEach(option => { option.textContent += ' · demo'; });
  document.querySelector('.business-switcher label').firstChild.textContent = 'Dataset ';
  const baseMetrics = metrics;
  metrics = function () {
    const result = baseMetrics();
    if (source === 'public' && publicData?.countryTotals?.length) {
      const top = publicData.countryTotals.slice(0, 5).map(item => [item.name, item.sales]);
      const other = Math.round(publicData.countryTotals.slice(5).reduce((sum, item) => sum + Math.round(item.sales * 100), 0)) / 100;
      result.by = Object.fromEntries([...top, ...(other > 0 ? [['Other destinations', other]] : [])]);
      result.best = publicData.countryTotals[0].name;
    }
    return result;
  };
  const methodNames = { seasonal: 'Trend + weekly seasonality', moving: 'Moving average', linear: 'Linear regression' };
  function evaluationForSelection() { return ForecastIQCore.evaluateForecast(rows, method.value, 30); }
  function renderSourceReport() {
    const summary = metrics(), evaluation = evaluationForSelection();
    const real = source === 'public', imported = source === 'upload';
    const title = real ? 'UCI Online Retail' : imported ? uploadedName : businessCatalog[activeBusiness].name;
    const notice = real ? 'Historical observed sales, not a current business feed. Positive non-cancelled sales only; returns are excluded.' : imported ? 'Based on your uploaded CSV. Currency is selected in Data manager; values are not converted.' : 'Synthetic demonstration records. These figures do not represent an actual business.';
    reportContent.innerHTML = `<p class="eyebrow">FORECASTIQ / PERFORMANCE REPORT</p><h2>Sales performance & demand outlook</h2><div class="source-report"><strong>${escapeText(title)}</strong><br>${notice}${real ? ' <a href="https://archive.ics.uci.edu/dataset/352/online+retail" target="_blank" rel="noopener">UCI source / CC BY 4.0</a>' : ''}</div><p>${rows.length} calendar records from ${rows[0].date} to ${rows.at(-1).date}. Currency: ${globalThis.ForecastIQCurrency}.</p><h3>Observed performance</h3><table><tr><th>Measure</th><th>Result</th></tr><tr><td>Sales in selected history</td><td>${money(summary.total)}</td></tr><tr><td>Average per calendar day</td><td>${money(summary.avg)}</td></tr><tr><td>Later half vs earlier half, daily average</td><td>${summary.growth.toFixed(1)}%</td></tr><tr><td>${real ? 'Largest destination market' : 'Leading category'}</td><td>${escapeText(summary.best)}</td></tr></table><h3>Model projection</h3><p>${methodNames[method.value]}. A 30-day projection begins on ${ForecastIQCore.addDaysISO(rows.at(-1).date, 1)}, immediately after the last observed day; projected total: <strong>${money(summary.ft)}</strong>.</p><p>${evaluation ? `Chronological holdout: ${evaluation.holdout} days. MAE ${money(evaluation.mae)} per day; RMSE ${money(evaluation.rmse)}; MAPE ${evaluation.mape == null ? 'unavailable' : evaluation.mape.toFixed(1) + '%'}. Percentage error excludes zero-sales days.` : 'At least 21 daily records are needed for holdout evaluation.'}</p><h3>Interpretation</h3><ul><li>Review the holdout error before treating the projection as a budget or inventory plan.</li><li>Compare the three forecasting methods in Forecast studio against the same historical holdout.</li><li>${real ? 'This historical retailer is an example for analysis. Use current records from your business for present-day decisions.' : 'Add promotion, stock availability and holiday context before interpreting changes as changes in demand.'}</li></ul><h3>Limitations</h3><p>Forecasts extrapolate recorded patterns. They do not account for future promotions, stock-outs, business changes, or holidays. Scenario ranges are sensitivity illustrations, not statistical confidence intervals.</p>`;
  }
  function escapeText(text) { const span = document.createElement('span'); span.textContent = text; return span.innerHTML; }
  function syncSource() {
    const imported = source === 'upload', real = source === 'public';
    const model = document.querySelector('#method').value;
    const evaluation = evaluationForSelection();
    const mape = evaluation?.mape;
    confidenceScore.textContent = mape == null ? '—' : mape.toFixed(1);
    confidenceRing.style.setProperty('--score', mape == null ? 0 : Math.max(0, 100 - Math.min(100, mape)));
    confidenceStatus.textContent = mape == null ? evaluation ? 'MAPE unavailable' : 'Not enough history' : mape < 10 ? 'Low error' : mape < 20 ? 'Review fit' : 'High error';
    stabilityScore.textContent = mape == null ? 'Unavailable' : mape < 12 ? 'High' : mape < 22 ? 'Moderate' : 'Review';
    document.querySelector('.business-switcher small').textContent = real ? 'REAL HISTORICAL SALES' : imported ? 'UPLOADED DATASET' : 'SYNTHETIC DEMO DATA';
    if (real) activeBusinessName.textContent = 'UCI Online Retail · UK retailer';
    else if (imported) activeBusinessName.textContent = uploadedName;
    businessUpdated.textContent = `Through ${rows.at(-1).date}`;
    businessRegion.textContent = real ? 'UCI repository · original GBP' : imported ? `${rows.length} validated records` : 'Illustrative business · not live sales';
    document.querySelector('.operations-grid').hidden = imported || real;
    document.querySelector('.operations-grid').style.display = imported || real ? 'none' : '';
    document.querySelector('.hero-kicker>span').textContent = real ? 'HISTORICAL RETAIL ANALYSIS' : imported ? 'YOUR SALES DATA' : 'DEMO PERFORMANCE OUTLOOK';
    document.querySelector('.target-panel .panel-head p').textContent = 'ILLUSTRATIVE TARGET';
    document.querySelector('.operations-panel .panel-head p').textContent = 'DEMO OPERATING ASSUMPTIONS';
    document.querySelector('.channel-mix').closest('article').querySelector('.panel-head p').textContent = 'DEMO CHANNEL MIX';
    document.querySelector('.journey-step small').textContent = `${rows.length} records loaded`;
    caption.textContent = `${real ? 'UCI observed transactions' : imported ? 'Uploaded CSV' : 'Synthetic demo'} · ${rows.length} calendar records (${rows[0].date} to ${rows.at(-1).date}). Latest ${Math.min(45, rows.length)} observed days + dashed 30-day projection. ${methodNames[model]}. Currency: ${globalThis.ForecastIQCurrency}.`;
    document.querySelector('#categoryChart').parentElement.querySelector('h3').textContent = real ? 'Sales by destination market' : 'Revenue contribution';
    document.querySelector('#categoryChart').parentElement.querySelector('.panel-head p').textContent = real ? 'MARKET MIX' : 'CATEGORY MIX';
    categoryCaption.textContent = real ? 'Destination country from the source transactions, across the full selected history. Small markets grouped as Other.' : 'Share of revenue across the full selected history. Exact source records are available in Data manager.';
    document.querySelector('#categoryKpi').parentElement.querySelector('.kpi-top p').textContent = real ? 'Largest market' : 'Best category';
    document.querySelector('#categoryKpi').parentElement.querySelector('.kpi-foot span').textContent = real ? 'By destination country' : 'Portfolio leader';
    const sourceName = real ? 'UCI Online Retail / real history' : imported ? uploadedName : 'Synthetic business demo';
    datasetContext.innerHTML = `<div><strong>${escapeText(sourceName)}</strong><span>${real ? 'Historical dataset · not live sales' : imported ? 'Uploaded sales records' : 'Illustrative data'}</span>${real ? '<a href="https://archive.ics.uci.edu/dataset/352/online+retail" target="_blank" rel="noopener">Source ↗</a>' : ''}</div><time>${rows[0].date} — ${rows.at(-1).date} · ${globalThis.ForecastIQCurrency}</time>`;
    datasetContext.hidden = document.querySelector('.nav.active')?.dataset.view === 'stocks';
    datasetContext.style.display = datasetContext.hidden ? 'none' : '';
    sourcePanelTitle.textContent = real ? 'UCI Online Retail · observed sales' : imported ? uploadedName : 'Synthetic demonstration data';
    sourcePanelDescription.textContent = real ? 'Daqing Chen’s public retail transaction dataset, published by UCI. Gross merchandise sales include positive quantities and prices; cancellations, shipping, fees and adjustments are excluded. Calendar dates without qualifying transactions are zero recorded sales. The analysis window is Jan–Nov 2011; the incomplete December 2011 is excluded. Values remain in original GBP.' : imported ? 'One aggregate sales row per date from your file. Select the currency that the original numbers use. The application does not infer margin, order counts, channels, or customers from revenue.' : 'A generated dataset for trying the controls. It is not a real company feed. Use the public retail dataset or upload your own records for data-based analysis.';
    sourcePanelLinks.innerHTML = real ? '<a href="https://archive.ics.uci.edu/dataset/352/online+retail" target="_blank" rel="noopener">Original dataset ↗</a><a href="https://doi.org/10.24432/C5BW33" target="_blank" rel="noopener">Citation & license ↗</a><a href="samples/uci-retail-daily.csv" download>Download daily CSV</a>' : '';
    currencySelect.value = globalThis.ForecastIQCurrency;
    currencySelect.disabled = !imported;
    currencyHint.textContent = imported ? 'Select the currency already used by your file. This labels values; it does not convert them.' : 'Fixed to the original source currency. No exchange conversion is applied.';
    revenueTrend.textContent = `${metrics().growth >= 0 ? '+' : ''}${metrics().growth.toFixed(1)}% daily-average change`;
    document.querySelector('#revenueKpi').parentElement.querySelector('.kpi-foot small').textContent = 'Later half vs earlier half';
    if (real) {
      const m = metrics();
      document.querySelector('#revenueKpi').parentElement.querySelector('.kpi-top p').textContent = 'Gross merchandise sales';
      dataSummary.innerHTML = `<div><strong>${rows.length}</strong><span>Calendar days</span></div><div><strong>${publicData.transactionCount.toLocaleString()}</strong><span>Qualifying sale lines</span></div><div><strong>${publicData.orderCount.toLocaleString()}</strong><span>Distinct invoices</span></div><div><strong>${rows[0].date} → ${rows.at(-1).date}</strong><span>Observed date range</span></div>`;
      document.querySelector('#insights').innerHTML = `<article class="insight"><b>Observed sales</b><p>${money(m.total)} recorded over ${rows.length} calendar days. Returns and cancellations are excluded, so this is gross positive sales.</p></article><article class="insight"><b>Largest destination market</b><p>${escapeText(m.best)} accounts for the largest share of sales in the original transactions. Country is a customer destination, not a product category.</p></article><article class="insight warn"><b>Historical planning example</b><p>The outlook begins after ${rows.at(-1).date}. It demonstrates the method on historical data and is not a forecast for today.</p></article>`;
      nextActionTitle.textContent = mape != null && mape > 20 ? 'Review model error before using the outlook' : 'Compare the historical forecasting methods';
      nextActionCopy.textContent = `This dataset ends on ${rows.at(-1).date}. Compare holdout MAE and MAPE in Forecast studio, then upload current business records for present-day planning.`;
      document.querySelector('#executiveSignals .signal-item:nth-child(2) .signal-copy span').textContent = `30 model days after ${rows.at(-1).date}; historical planning example.`;
      document.querySelector('#executiveSignals .signal-item:nth-child(3) .signal-copy span').textContent = 'Review the source history and holdout errors before drawing operational conclusions.';
    } else document.querySelector('#revenueKpi').parentElement.querySelector('.kpi-top p').textContent = 'Total revenue';
    renderSourceReport();
    document.querySelectorAll('.nav').forEach(button => button.setAttribute('aria-current', button.classList.contains('active') ? 'page' : 'false'));
  }
  const originalRender = render;
  render = function () { originalRender(); syncSource(); };
  const originalSummary = renderExecutiveSummary;
  renderExecutiveSummary = function () { originalSummary(); syncSource(); };
  const originalForecast = renderForecast;
  renderForecast = function () { originalForecast(); syncSource(); };
  const originalCompany = openCompanyPage;
  openCompanyPage = function (filename) {
    source = 'upload'; uploadedName = companyNameFromFile(filename);
    globalThis.ForecastIQCurrency = 'INR';
    render(); originalCompany(filename); renderScenario(); syncSource();
  };
  const originalSelect = selectBusiness;
  function loadPublicData() {
    if (!publicData?.rows?.length) { toastMsg('Public dataset could not be loaded. Refresh the page.'); return; }
    source = 'public'; globalThis.ForecastIQCurrency = publicData.currency;
    rows = publicData.rows.map(item => ({ ...item })); businessSelector.value = 'uci';
    companyNav.classList.add('hidden');
    render(); renderExecutiveSummary(); renderScenario(); syncSource();
  }
  selectBusiness = function (key) { if (key === 'uci') return loadPublicData(); source = 'demo'; globalThis.ForecastIQCurrency = 'INR'; originalSelect(key); syncSource(); };
  resetBtn.onclick = loadPublicData;
  currencySelect.addEventListener('change', () => {
    if (source !== 'upload') return;
    const currentView = document.querySelector('.nav.active').dataset.view;
    globalThis.ForecastIQCurrency = currencySelect.value;
    render(); renderScenario(); originalCompany(`${uploadedName}.csv`); syncSource();
    document.querySelector('#companyCoverage span:last-child').textContent = `Currency: ${globalThis.ForecastIQCurrency}`;
    if (currentView !== 'businessDetail') document.querySelector(`.nav[data-view="${currentView}"]`).click();
  });
  method.addEventListener('change', () => { render(); renderExecutiveSummary(); renderScenario(); });
  document.querySelectorAll('.nav').forEach(button => button.addEventListener('click', () => {
    Object.values(charts).forEach(item => { if (typeof item.resize === 'function') item.resize(); });
    syncSource();
  }));
  if (publicData?.rows?.length) loadPublicData(); else { render(); syncSource(); }
  globalThis.ForecastIQWorkspace = { loadPublicData, getSource: () => source };
})();
