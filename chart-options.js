(function (root) {
  'use strict';
  const palette = ['#227d6c', '#668bb2', '#9dafba', '#abc6bd', '#ba9c76', '#cbd4d9'];
  function currencyCode() { return /^[A-Z]{3}$/.test(root.ForecastIQCurrency || '') ? root.ForecastIQCurrency : 'INR'; }
  function currency(value, compact = false, code = currencyCode()) {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : code === 'USD' ? 'en-US' : 'en-GB', {
      style: 'currency', currency: code,
      minimumFractionDigits: compact ? 0 : 2, maximumFractionDigits: compact ? 1 : 2,
      ...(compact ? { notation: 'compact' } : {})
    }).format(value);
  }
  function dateLabel(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value;
    return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }
  function configure(id, type, data, overrides = {}) {
    const { valueFormat, currency: selectedCurrency, axisTitle, ...chartOverrides } = overrides;
    const percentage = valueFormat === 'percent' || ['stockDrawdownChart', 'stockMonthlyReturnsChart'].includes(id);
    const indexed = id === 'stockChart' && !percentage && valueFormat !== 'currency';
    const overview = ['salesChart', 'categoryChart', 'monthlySalesChart', 'weekdaySalesChart'].includes(id) && root.ForecastIQOverviewCurrency;
    const code = overview ? 'USD' : selectedCurrency || currencyCode();
    const displayMoney = (value, compact = false) => currency(value, compact, code);
    const datasets = data.datasets.map((dataset, index) => ({
      ...dataset,
      ...(overview ? { data: dataset.data.map(value => Number.isFinite(value) ? overview.convert(value) : value) } : {}),
      ...(type === 'doughnut' ? { backgroundColor: palette, borderColor: '#fff', borderWidth: 3, hoverOffset: 5 } : {
        borderColor: dataset.borderColor || palette[index % palette.length], backgroundColor: dataset.backgroundColor || (type === 'bar' ? palette[index % palette.length] + 'bb' : index ? '#668bb20a' : '#227d6c0b'),
        ...(type === 'bar' ? { borderRadius: 4, maxBarThickness: 34 } : {}),
        borderWidth: 2, tension: 0, pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 12,
        borderDash: /forecast|predicted/i.test(dataset.label || '') ? [5, 4] : (dataset.borderDash || []),
        fill: dataset.fill || false, spanGaps: false
      })
    }));
    const defaults = {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 250 },
      layout: { padding: { top: 8, right: 8, bottom: 0, left: 0 } },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: type === 'doughnut' ? 'circle' : 'line', boxWidth: 18, padding: 20, color: '#70828c', font: { size: 11, family: 'Segoe UI, sans-serif' } } },
        tooltip: { backgroundColor: '#193640', titleColor: '#fff', bodyColor: '#dce9e9', padding: 12, cornerRadius: 7, displayColors: true,
          callbacks: { title: items => items[0]?.label || '', label: context => {
            const value = type === 'doughnut' ? context.parsed : context.parsed?.y;
            if (!Number.isFinite(value)) return `${context.dataset.label || context.label}: unavailable`;
            if (type === 'doughnut') {
              const total = context.dataset.data.reduce((sum, item) => sum + (Number.isFinite(item) ? item : 0), 0);
              return `${context.label}: ${displayMoney(value)} (${total ? (value / total * 100).toFixed(1) : '0'}%)`;
            }
            return `${context.dataset.label}: ${percentage ? (value > 0 ? '+' : '') + value.toFixed(2) + '%' : indexed ? Number(value).toFixed(2) + ' index points' : displayMoney(value)}`;
          } }
        }
      },
      scales: type === 'doughnut' ? {} : {
        x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0, color: '#81919a', font: { size: 10 }, callback(value) { return dateLabel(this.getLabelForValue(value)); } } },
        y: { beginAtZero: type === 'bar' || (!indexed && !percentage && id !== 'stockChart'), grace: '8%', border: { display: false }, grid: { color: '#edf1f3', drawTicks: false }, title: { display: true, text: axisTitle || (percentage ? 'Return (%)' : indexed ? 'Indexed performance · first day = 100' : `Daily revenue · ${code}`), color: '#81919a', font: { size: 10 } }, ticks: { maxTicksLimit: 5, padding: 10, color: '#81919a', font: { size: 10 }, callback: value => percentage ? Number(value).toFixed(1) + '%' : indexed ? Number(value).toFixed(0) : displayMoney(value, true) } }
      }
    };
    if (id === 'stockDrawdownChart') defaults.scales.y.max = 0;
    const options = { ...defaults, ...chartOverrides, plugins: { ...defaults.plugins, ...chartOverrides.plugins }, scales: chartOverrides.scales || defaults.scales };
    if (type === 'doughnut') options.cutout = overrides.cutout || '74%';
    // A visible boundary separates observed values from estimates without inventing a confidence band.
    const forecastBoundary = {
      id: 'forecastBoundary',
      beforeDatasetsDraw(chart) {
        if (type === 'doughnut' || !chart.chartArea || !chart.scales?.x) return;
        const projected = datasets.find(dataset => /forecast|predicted/i.test(dataset.label || ''));
        if (!projected) return;
        const first = projected.data.findIndex(Number.isFinite);
        if (first < 0 || first >= data.labels.length - 1) return;
        const { ctx, chartArea: area, scales: { x } } = chart;
        const boundary = (x.getPixelForValue(first) + x.getPixelForValue(first + 1)) / 2;
        ctx.save();
        ctx.fillStyle = '#668bb20a';
        ctx.fillRect(boundary, area.top, area.right - boundary, area.bottom - area.top);
        ctx.strokeStyle = '#a9b9c6'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(boundary, area.top); ctx.lineTo(boundary, area.bottom); ctx.stroke();
        ctx.setLineDash([]); ctx.font = '10px Segoe UI, sans-serif'; ctx.fillStyle = '#668193';
        const label = 'Model projection';
        if (area.right - boundary > ctx.measureText(label).width + 16) ctx.fillText(label, boundary + 8, area.top + 13);
        ctx.restore();
      }
    };
    const focusLine = {
      id: 'focusLine', afterDatasetsDraw(chart) {
        if (type !== 'line') return;
        const point = chart.getActiveElements?.()[0]?.element;
        if (!point || !chart.chartArea) return;
        const { ctx, chartArea } = chart;
        ctx.save(); ctx.strokeStyle = '#b4c5cb'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(point.x, chartArea.top); ctx.lineTo(point.x, chartArea.bottom); ctx.stroke(); ctx.restore();
      }
    };
    return { type, data: { ...data, datasets }, options, plugins: [forecastBoundary, focusLine] };
  }
  root.ForecastIQChartOptions = configure;
  if (typeof module !== 'undefined') module.exports = configure;
})(globalThis);
