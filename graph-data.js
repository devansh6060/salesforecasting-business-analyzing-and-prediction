(function (root) {
  'use strict';
  const monthLabel = date => new Date(`${date.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  function movingAverage(values, window = 7) {
    return values.map((_, index) => index < window - 1 ? null : values.slice(index - window + 1, index + 1).reduce((sum, value) => sum + value, 0) / window);
  }
  function monthlySales(rows) {
    const months = new Map();
    rows.forEach(row => months.set(row.date.slice(0, 7), (months.get(row.date.slice(0, 7)) || 0) + row.sales));
    return { labels: [...months.keys()].map(monthLabel), values: [...months.values()] };
  }
  function weekdaySales(rows) {
    const values = Array(7).fill(0), counts = Array(7).fill(0);
    rows.forEach(row => { const day = (new Date(`${row.date}T00:00:00Z`).getUTCDay() + 6) % 7; values[day] += row.sales; counts[day]++; });
    return { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], values: values.map((total, i) => counts[i] ? total / counts[i] : null) };
  }
  function drawdowns(rows, field) {
    let peak = 0;
    return rows.map(row => { peak = Math.max(peak, row[field]); return (row[field] / peak - 1) * 100; });
  }
  function monthlyReturns(rows) {
    if (!rows.length) return { labels: [], stock: [], benchmark: [] };
    const ends = new Map();
    rows.forEach(row => ends.set(row.date.slice(0, 7), row));
    let previous = rows[0];
    const result = { labels: [], stock: [], benchmark: [] };
    ends.forEach((last, month) => {
      if (last.date !== previous.date) {
        result.labels.push(monthLabel(month));
        for (const field of ['stock', 'benchmark']) result[field].push((last[field] / previous[field] - 1) * 100);
      }
      previous = last;
    });
    return result;
  }
  root.ForecastIQGraphData = { movingAverage, monthlySales, weekdaySales, drawdowns, monthlyReturns };
  if (typeof module !== 'undefined') module.exports = root.ForecastIQGraphData;
})(globalThis);
