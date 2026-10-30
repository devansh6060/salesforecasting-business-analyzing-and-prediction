(function () {
  'use strict';
  if (window.Chart) return;

  const palette = ['#227d6c', '#668bb2', '#9dafba', '#abc6bd', '#ba9c76'];
  function clipped(context, text, width) {
    let result = String(text);
    if (context.measureText(result).width <= width) return result;
    while (result.length && context.measureText(result + '…').width > width) result = result.slice(0, -1);
    return result + '…';
  }

  class ForecastIQChart {
    constructor(target, config) {
      this.canvas = typeof target === 'string' ? document.getElementById(target) : target;
      this.config = config || {};
      this.context = this.canvas.getContext('2d');
      this.resize = this.draw.bind(this);
      this.hover = this.showValue.bind(this);
      window.addEventListener('resize', this.resize);
      this.canvas.addEventListener('pointermove', this.hover);
      this.draw();
    }

    destroy() {
      window.removeEventListener('resize', this.resize);
      this.canvas.removeEventListener('pointermove', this.hover);
      this.canvas.removeAttribute('title');
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    prepare() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(160, rect.width || this.canvas.parentElement.clientWidth || 640);
      const height = Math.max(220, rect.height || 300);
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.context.clearRect(0, 0, width, height);
      this.context.font = '12px Inter, Arial, sans-serif';
      this.context.lineJoin = 'round';
      this.context.lineCap = 'round';
      return { width, height };
    }

    legend(datasets, width) {
      const context = this.context;
      let x = 12, y = 16;
      datasets.forEach((dataset, index) => {
        const text = clipped(context, dataset.label || `Series ${index + 1}`, Math.max(50, width - 65));
        const itemWidth = context.measureText(text).width + 50;
        if (x > 12 && x + itemWidth > width - 10) { x = 12; y += 20; }
        context.fillStyle = dataset.borderColor || dataset.backgroundColor || palette[index % palette.length];
        context.fillRect(x, y - 5, 18, 3);
        context.fillStyle = '#43515c';
        context.fillText(text, x + 25, y);
        x += itemWidth;
      });
      return y + 16;
    }

    drawLine(size) {
      const context = this.context;
      const datasets = this.config.data.datasets || [];
      const labels = this.config.data.labels || [];
      const values = datasets.flatMap(dataset => dataset.data || []).filter(Number.isFinite);
      if (!values.length) return;
      const legendHeight = this.legend(datasets, size.width);
      const formatTick = this.config.options?.scales?.y?.ticks?.callback || (value => value >= 1000 ? `${Math.round(value / 1000)}k` : Math.round(value));
      const widestTick = Math.max(...[Math.min(...values), Math.max(...values)].map(value => context.measureText(String(formatTick(value))).width));
      const padding = { left: Math.max(48, widestTick + 14), right: 15, top: legendHeight, bottom: 35 };
      const plotWidth = size.width - padding.left - padding.right;
      const plotHeight = size.height - padding.top - padding.bottom;
      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const margin = Math.max(1, (rawMax - rawMin) * 0.08);
      const minimum = rawMin >= 0 ? Math.max(0, rawMin - margin) : rawMin - margin;
      const maximum = rawMax + margin;
      const range = maximum - minimum || 1;
      context.strokeStyle = '#e4e8e5';
      context.fillStyle = '#6f7a82';
      context.lineWidth = 1;
      for (let step = 0; step <= 4; step += 1) {
        const y = padding.top + plotHeight * step / 4;
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(size.width - padding.right, y);
        context.stroke();
        const value = maximum - range * step / 4;
        context.fillText(String(formatTick(value)), 5, y + 4);
      }
      const xFor = index => padding.left + (labels.length <= 1 ? 0 : plotWidth * index / (labels.length - 1));
      const yFor = value => padding.top + plotHeight - (value - minimum) / range * plotHeight;
      this.plot = { padding, plotWidth, labels, datasets, width: size.width, height: size.height };
      const projected = datasets.find(dataset => /forecast|predicted/i.test(dataset.label || ''));
      if (projected) {
        const first = projected.data.findIndex(Number.isFinite);
        if (first >= 0 && first < labels.length - 1) {
          const boundary = (xFor(first) + xFor(first + 1)) / 2;
          context.fillStyle = '#668bb20a'; context.fillRect(boundary, padding.top, size.width - padding.right - boundary, plotHeight);
          context.strokeStyle = '#a9b9c6'; context.setLineDash([3, 4]);
          context.beginPath(); context.moveTo(boundary, padding.top); context.lineTo(boundary, padding.top + plotHeight); context.stroke(); context.setLineDash([]);
        }
      }
      datasets.forEach((dataset, datasetIndex) => {
        const color = dataset.borderColor || palette[datasetIndex % palette.length];
        const segments = [];
        let current = [];
        (dataset.data || []).forEach((value, index) => {
          if (Number.isFinite(value)) current.push([xFor(index), yFor(value)]);
          else if (current.length) { segments.push(current); current = []; }
        });
        if (current.length) segments.push(current);
        context.strokeStyle = color;
        context.lineWidth = 2.4;
        context.setLineDash(dataset.borderDash || []);
        segments.forEach(points => {
          if (dataset.fill && points.length > 1) {
            context.beginPath();
            context.moveTo(points[0][0], padding.top + plotHeight);
            points.forEach(([x, y]) => context.lineTo(x, y));
            context.lineTo(points.at(-1)[0], padding.top + plotHeight);
            context.closePath();
            context.globalAlpha = 0.09;
            context.fillStyle = dataset.backgroundColor || color;
            context.fill();
            context.globalAlpha = 1;
          }
          context.beginPath();
          points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
          context.stroke();
        });
        context.setLineDash([]);
      });
      context.fillStyle = '#6f7a82';
      const tickCount = Math.min(Math.max(2, Math.floor(plotWidth / 72)), labels.length);
      for (let tick = 0; tick < tickCount; tick += 1) {
        const index = Math.round((labels.length - 1) * tick / Math.max(1, tickCount - 1));
        const rawLabel = String(labels[index] || '');
        const label = /^\d{4}-\d{2}-\d{2}$/.test(rawLabel) ? new Date(`${rawLabel}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : rawLabel;
        const textWidth = context.measureText(label).width;
        context.fillText(label, Math.max(padding.left, Math.min(size.width - padding.right - textWidth, xFor(index) - textWidth / 2)), size.height - 12);
      }
    }

    drawDoughnut(size) {
      const context = this.context;
      const dataset = (this.config.data.datasets || [])[0] || { data: [] };
      const values = dataset.data || [];
      const labels = this.config.data.labels || [];
      const total = values.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) || 1;
      const legendHeight = Math.min(size.height * .5, labels.length * 20 + 14);
      const centerX = size.width / 2;
      const centerY = (size.height - legendHeight) / 2 + 4;
      const outer = Math.max(20, Math.min(size.width * .32, (size.height - legendHeight) * .43));
      const inner = outer * .74;
      let angle = -Math.PI / 2;
      values.forEach((value, index) => {
        const portion = Math.max(0, Number(value) || 0) / total * Math.PI * 2;
        context.beginPath();
        context.arc(centerX, centerY, outer, angle, angle + portion);
        context.arc(centerX, centerY, inner, angle + portion, angle, true);
        context.closePath();
        context.fillStyle = (dataset.backgroundColor || palette)[index % (dataset.backgroundColor || palette).length];
        context.fill();
        angle += portion;
      });
      context.fillStyle = '#17324d';
      context.textAlign = 'center';
      context.font = '700 17px Inter, Arial, sans-serif';
      context.fillText(values.some(value => value > 0) ? '100%' : 'No revenue', centerX, centerY + 5);
      context.textAlign = 'left';
      context.font = '12px Inter, Arial, sans-serif';
      labels.forEach((label, index) => {
        const y = size.height - legendHeight + 15 + index * 20;
        if (y > size.height - 5) return;
        const percent = (Math.max(0, values[index] || 0) / total * 100).toFixed(1) + '%';
        context.fillStyle = (dataset.backgroundColor || palette)[index % (dataset.backgroundColor || palette).length];
        context.fillRect(12, y - 8, 8, 8);
        context.fillStyle = '#43515c';
        context.fillText(clipped(context, label, size.width - context.measureText(percent).width - 52), 28, y);
        context.textAlign = 'right'; context.fillText(percent, size.width - 12, y); context.textAlign = 'left';
      });
    }

    showValue(event) {
      if (!this.plot || this.config.type === 'doughnut') return;
      const rect = this.canvas.getBoundingClientRect();
      const { padding, plotWidth, labels, datasets, width } = this.plot;
      const mouseX = (event.clientX - rect.left) / (rect.width || width) * width;
      if (mouseX < padding.left || mouseX > padding.left + plotWidth) { this.canvas.removeAttribute('title'); return; }
      const index = Math.max(0, Math.min(labels.length - 1, Math.round((mouseX - padding.left) / plotWidth * (labels.length - 1))));
      const format = this.config.options?.plugins?.tooltip?.callbacks?.label;
      const lines = datasets.filter(dataset => Number.isFinite(dataset.data[index])).map(dataset => format
        ? format({ dataset, parsed: { y: dataset.data[index] }, label: labels[index] })
        : `${dataset.label}: ${dataset.data[index]}`);
      this.canvas.title = [labels[index], ...lines].join('\n');
    }

    draw() {
      const size = this.prepare();
      if (this.config.type === 'doughnut') this.drawDoughnut(size);
      else this.drawLine(size);
    }
  }

  window.Chart = ForecastIQChart;
  window.ForecastIQChartFallback = true;
})();
