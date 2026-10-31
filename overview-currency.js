(function (root) {
  'use strict';
  const rates = new Map([['USD', { rate: 1, date: null }]]);
  const pending = new Map();
  const errors = new Set();
  const current = () => root.ForecastIQCurrency || 'INR';
  const format = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function convert(value) {
    const entry = rates.get(current());
    return entry && Number.isFinite(value) ? value * entry.rate : null;
  }
  root.overviewMoney = value => {
    const converted = convert(value);
    return converted == null ? '\u2014' : format.format(converted);
  };
  function redraw() {
    render(); renderBusinessPulse(); renderScenario(); renderExecutiveSummary();
  }
  function sync() {
    const base = current();
    let note = document.getElementById('overviewCurrencyNote');
    if (!note) {
      note = document.createElement('p');
      note.id = 'overviewCurrencyNote'; note.className = 'overview-currency-note'; note.setAttribute('role', 'status');
      document.querySelector('#dashboard .kpis').before(note);
    }
    const entry = rates.get(base);
    note.replaceChildren();
    if (entry) {
      note.textContent = base === 'USD' ? 'Amounts shown in US dollars (USD).' : `Amounts in USD | 1 ${base} = $${entry.rate.toFixed(6)} | Reference rate: ${entry.date} (Frankfurter). Latest-rate conversion, including historical sales.`;
      return;
    }
    if (errors.has(base)) {
      note.append('USD conversion unavailable. ');
      const retry = document.createElement('button'); retry.textContent = 'Retry conversion';
      retry.onclick = () => { errors.delete(base); sync(); };
      note.append(retry); return;
    }
    note.textContent = 'Converting Overview amounts to US dollars...';
    if (pending.has(base)) return;
    const request = (async () => {
      try {
        const data = await marketJSON('/api/exchange-rate?base=' + encodeURIComponent(base));
        if (data.base !== base || data.quote !== 'USD' || !Number.isFinite(data.rate) || data.rate <= 0) throw Error('Invalid rate');
        rates.set(base, data);
      } catch { errors.add(base); }
      finally {
        pending.delete(base);
        if (current() === base) redraw();
      }
    })();
    pending.set(base, request);
  }
  root.ForecastIQOverviewCurrency = { convert, sync };
})(globalThis);
