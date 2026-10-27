(function () {
  'use strict';
  if (window.Chart) return;

  const palette = ['#0c7357', '#c9a44f', '#ed785f', '#789c92', '#d7c2a0', '#6f7d90'];

  class ForecastIQChart {
    constructor(target, config) {
      this.canvas = typeof target === 'string' ? document.getElementById(target) : target;
      this.config = config || {};
      this.context = this.canvas.getContext('2d');
      this.resize = this.draw.bind(this);
      window.addEventListener('resize', this.resize);
      this.draw();
    }

    destroy() {
      window.removeEventListener('resize', this.resize);
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    prepare() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(320, rect.width || this.canvas.parentElement.clientWidth || 640);
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
      let x = 18;
      datasets.forEach((dataset, index) => {
        context.fillStyle = dataset.borderColor || dataset.backgroundColor || palette[index % palette.length];
        context.fillRect(x, 11, 18, 3);
        context.fillStyle = '#43515c';
        context.fillText(dataset.label || `Series ${index + 1}`, x + 25, 16);
        x += Math.min(190, context.measureText(dataset.label || '').width + 62);
        if (x > width - 150) x = 18;
      });
    }

    drawLine(size) {
      const context = this.context;
      const datasets = this.config.data.datasets || [];
      const labels = this.config.data.labels || [];
      const values = datasets.flatMap(dataset => dataset.data || []).filter(Number.isFinite);
      if (!values.length) return;
      const padding = { left: 58, right: 20, top: 38, bottom: 35 };
      const plotWidth = size.width - padding.left - padding.right;
      const plotHeight = size.height - padding.top - padding.bottom;
      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const margin = Math.max(1, (rawMax - rawMin) * 0.08);
      const minimum = Math.max(0, rawMin - margin);
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
        context.fillText(value >= 1000 ? `${Math.round(value / 1000)}k` : Math.round(value), 8, y + 4);
      }
      const xFor = index => padding.left + (labels.length <= 1 ? 0 : plotWidth * index / (labels.length - 1));
      const yFor = value => padding.top + plotHeight - (value - minimum) / range * plotHeight;
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
      const tickCount = Math.min(6, labels.length);
      for (let tick = 0; tick < tickCount; tick += 1) {
        const index = Math.round((labels.length - 1) * tick / Math.max(1, tickCount - 1));
        const label = String(labels[index] || '').slice(5);
        context.fillText(label, Math.min(size.width - 56, xFor(index) - 15), size.height - 12);
      }
      this.legend(datasets, size.width);
    }

    drawDoughnut(size) {
      const context = this.context;
      const dataset = (this.config.data.datasets || [])[0] || { data: [] };
      const values = dataset.data || [];
      const labels = this.config.data.labels || [];
      const total = values.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) || 1;
      const centerX = size.width * 0.38;
      const centerY = size.height * 0.53;
      const outer = Math.min(size.width, size.height) * 0.29;
      const inner = outer * 0.67;
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
      context.fillText('100%', centerX, centerY + 5);
      context.textAlign = 'left';
      context.font = '12px Inter, Arial, sans-serif';
      labels.forEach((label, index) => {
        const y = 45 + index * 27;
        context.fillStyle = (dataset.backgroundColor || palette)[index % (dataset.backgroundColor || palette).length];
        context.fillRect(size.width * 0.68, y - 9, 11, 11);
        context.fillStyle = '#43515c';
        context.fillText(String(label), size.width * 0.68 + 18, y);
      });
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
