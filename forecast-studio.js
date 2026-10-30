(function () {
  'use strict';

  const methodDetails = {
    seasonal: {
      name: 'Trend + weekly seasonality',
      short: 'Weekly seasonality',
      description: 'Combines the overall direction of sales with recurring day-of-week patterns. Best for retail, food and other businesses with predictable weekly peaks.',
      recommendation: 'Use this demand curve to time replenishment and retain a safety buffer around the strongest weekdays.'
    },
    moving: {
      name: 'Moving average',
      short: 'Moving average',
      description: 'Uses the recent average as a stable baseline. Useful when demand is relatively steady and short-term operations matter more than long-range growth.',
      recommendation: 'Treat this as a conservative operating baseline for near-term purchasing, staffing and cash planning.'
    },
    linear: {
      name: 'Linear regression',
      short: 'Linear trend',
      description: 'Extends the historical growth or decline direction into the future. Useful for strategic scenarios, but it does not model weekly peaks.',
      recommendation: 'Use the directional trend for budgets and capacity discussions, then stress-test it against operational constraints.'
    }
  };

  const studio = {
    forecastTotal: document.getElementById('studioForecastTotal'),
    dailyAverage: document.getElementById('studioDailyAverage'),
    peakDay: document.getElementById('studioPeakDay'),
    growth: document.getElementById('studioGrowth'),
    horizon: document.getElementById('studioHorizon'),
    range: document.getElementById('studioForecastRange'),
    recommendation: document.getElementById('studioRecommendation'),
    direction: document.getElementById('outcomeDirection'),
    description: document.getElementById('methodDescription'),
    trainingWindow: document.getElementById('trainingWindow'),
    trainingCoverage: document.getElementById('trainingCoverage'),
    chartSubtitle: document.getElementById('forecastChartSubtitle'),
    updated: document.getElementById('forecastUpdated'),
    comparisonRows: document.getElementById('modelComparisonRows'),
    recommendedModel: document.getElementById('recommendedModel'),
    accuracyScore: document.getElementById('accuracyScore'),
    accuracyHeadline: document.getElementById('accuracyHeadline'),
    accuracyExplanation: document.getElementById('accuracyExplanation'),
    accuracyMarker: document.querySelector('.accuracy-scale i'),
    status: document.getElementById('forecastStatus')
  };

  function percent(value) {
    return value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;
  }

  function accuracyLabel(mape) {
    if (mape == null) return { label: 'Needs more data', className: 'review' };
    if (mape < 10) return { label: 'Excellent fit', className: '' };
    if (mape < 20) return { label: 'Useful baseline', className: '' };
    return { label: 'Review model', className: 'review' };
  }

  function comparisonEvaluations() {
    return ['seasonal', 'moving', 'linear'].map(key => ({
      key,
      evaluation: ForecastIQCore.evaluateForecast(rows, key, 30)
    }));
  }

  function renderComparison(currentMethod) {
    const comparisons = comparisonEvaluations();
    const valid = comparisons.filter(item => item.evaluation?.mape != null);
    const best = valid.length ? [...valid].sort((a, b) => a.evaluation.mape - b.evaluation.mape)[0] : null;
    studio.recommendedModel.textContent = best ? `Recommended: ${methodDetails[best.key].short}` : 'More data required';
    studio.comparisonRows.innerHTML = comparisons.map(({ key, evaluation }) => {
      const assessment = accuracyLabel(evaluation?.mape);
      const classes = [key === currentMethod ? 'selected' : '', key === best?.key ? 'recommended' : ''].filter(Boolean).join(' ');
      return `<tr class="${classes}"><td><span class="model-name"><strong>${methodDetails[key].short}</strong><small>${key === best?.key ? 'Best holdout result' : methodDetails[key].name}</small></span></td><td>${evaluation ? money(evaluation.mae) : '—'}</td><td>${evaluation ? money(evaluation.rmse) : '—'}</td><td>${percent(evaluation?.mape)}</td><td>${evaluation ? `${evaluation.bias >= 0 ? '+' : ''}${money(evaluation.bias)}` : '—'}</td><td><span class="assessment ${assessment.className}">${assessment.label}</span></td></tr>`;
    }).join('');
  }

  function renderAccuracy(evaluation) {
    const mape = evaluation?.mape;
    const assessment = accuracyLabel(mape);
    studio.accuracyScore.innerHTML = `<strong>${percent(mape)}</strong><span>MAPE</span>`;
    studio.accuracyHeadline.textContent = assessment.label;
    studio.accuracyMarker.style.left = `${mape == null ? 100 : Math.min(100, Math.max(0, mape / 30 * 100))}%`;
    studio.accuracyExplanation.textContent = evaluation
      ? `Across ${evaluation.holdout} unseen historical days, predictions differed from actual sales by ${percent(mape)} on average. MAE was ${money(evaluation.mae)} per day.`
      : 'At least 21 valid daily records are required for a chronological holdout accuracy test.';
  }

  function renderForecastStudio() {
    if (!rows?.length) return;
    const days = Number(horizon.value);
    const selectedMethod = method.value;
    const detail = methodDetails[selectedMethod];
    const projection = forecast(rows, days, selectedMethod);
    const total = projection.reduce((sum, item) => sum + item.sales, 0);
    const dailyAverage = total / days;
    const recent = rows.slice(-Math.min(days, rows.length));
    const recentAverage = recent.reduce((sum, item) => sum + item.sales, 0) / recent.length;
    const growth = recentAverage ? (dailyAverage / recentAverage - 1) * 100 : 0;
    const peak = [...projection].sort((a, b) => b.sales - a.sales)[0];
    const evaluation = ForecastIQCore.evaluateForecast(rows, selectedMethod, 30);
    const sensitivity = evaluation ? evaluation.mae * days : null;
    const lower = sensitivity == null ? null : Math.max(0, total - sensitivity);
    const upper = sensitivity == null ? null : total + sensitivity;

    studio.forecastTotal.textContent = money(total);
    studio.dailyAverage.textContent = money(dailyAverage);
    studio.peakDay.textContent = new Date(`${peak.date}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    studio.growth.textContent = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
    studio.growth.className = growth >= 0 ? 'positive' : 'negative';
    studio.horizon.textContent = `${days} days`;
    studio.range.textContent = sensitivity == null ? 'More history needed to measure forecast error' : `Sensitivity: ${money(lower)} – ${money(upper)} (± daily holdout MAE; not a confidence interval)`;
    studio.recommendation.textContent = `${detail.recommendation} Projected demand is ${Math.abs(growth).toFixed(1)}% ${growth >= 0 ? 'above' : 'below'} the recent daily run rate.`;
    studio.direction.textContent = growth >= 0 ? '↗' : '↘';
    studio.direction.className = growth >= 0 ? 'positive' : 'negative';
    studio.description.innerHTML = `<strong>${detail.name}</strong><p>${detail.description}</p>`;
    studio.trainingWindow.textContent = `${rows[0].date} → ${rows.at(-1).date}`;
    const categoryCount = new Set(rows.map(item => item.category)).size;
    studio.trainingCoverage.textContent = `${rows.length.toLocaleString('en-IN')} validated daily records · ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}`;
    studio.chartSubtitle.textContent = `${days}-day outlook using ${detail.short.toLowerCase()}`;
    studio.updated.textContent = 'Preview refreshed';

    document.querySelectorAll('#quickHorizons [data-horizon]').forEach(button => button.classList.toggle('active', Number(button.dataset.horizon) === days));
    document.querySelectorAll('.forecast-preset').forEach(button => button.classList.toggle('active', button.dataset.method === selectedMethod && Number(button.dataset.horizon) === days));
    renderComparison(selectedMethod);
    renderAccuracy(evaluation);
  }

  const baseRenderForecast = renderForecast;
  renderForecast = function () {
    baseRenderForecast();
    renderForecastStudio();
  };

  document.querySelectorAll('#quickHorizons [data-horizon]').forEach(button => {
    button.addEventListener('click', () => {
      horizon.value = button.dataset.horizon;
      horizon.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  document.querySelectorAll('.forecast-preset').forEach(button => {
    button.addEventListener('click', () => {
      method.value = button.dataset.method;
      horizon.value = button.dataset.horizon;
      method.dispatchEvent(new Event('change', { bubbles: true }));
      horizon.dispatchEvent(new Event('input', { bubbles: true }));
      toastMsg(`${button.querySelector('strong').textContent} preset applied`);
    });
  });

  trainBtn.addEventListener('click', () => {
    studio.status.classList.add('running');
    studio.status.lastChild.textContent = ' Forecast running';
    setTimeout(() => {
      studio.status.classList.remove('running');
      studio.status.lastChild.textContent = ' Forecast complete';
      studio.updated.textContent = `Trained ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
    }, 450);
  });

  exportForecastBtn.addEventListener('click', () => {
    const projection = forecast(rows, Number(horizon.value), method.value);
    const csv = ['date,forecast_sales,method', ...projection.map(item => `${item.date},${item.sales},${method.value}`)].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `forecast-${method.value}-${horizon.value}-days.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toastMsg('Forecast CSV exported');
  });

  renderForecastStudio();
})();
