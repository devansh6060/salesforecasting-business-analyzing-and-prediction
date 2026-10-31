(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ForecastIQCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  function parseISODate(value) {
    if (!ISO_DATE.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return null;
    return date;
  }

  function isValidISODate(value) {
    return parseISODate(String(value || '').trim()) !== null;
  }

  function formatISODate(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDaysISO(value, days) {
    const date = parseISODate(value);
    if (!date) throw new Error(`Invalid ISO date: ${value}`);
    date.setUTCDate(date.getUTCDate() + days);
    return formatISODate(date);
  }

  function weekdayUTC(value) {
    const date = parseISODate(value);
    if (!date) throw new Error(`Invalid ISO date: ${value}`);
    return date.getUTCDay();
  }

  function parseDelimited(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('The CSV file is empty.');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const source = text.replace(/^\uFEFF/, '');
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ',') {
        row.push(field);
        field = '';
      } else if (character === '\n') {
        row.push(field.replace(/\r$/, ''));
        if (row.some(value => value.trim() !== '')) rows.push(row);
        row = [];
        field = '';
      } else {
        field += character;
      }
    }
    if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
    row.push(field.replace(/\r$/, ''));
    if (row.some(value => value.trim() !== '')) rows.push(row);
    if (rows.length < 2) throw new Error('The CSV needs a header and at least one data row.');
    return rows;
  }

  function normalizedHeaders(row) {
    return row.map(value => value.trim().toLowerCase().replace(/^\uFEFF/, ''));
  }

  function assertUniqueHeaders(headers) {
    const duplicate = headers.find((value, index) => value && headers.indexOf(value) !== index);
    if (duplicate) throw new Error(`The CSV contains a duplicate "${duplicate}" header.`);
  }

  function parseSalesCSV(text, minimumRows = 14) {
    const matrix = parseDelimited(text);
    const headers = normalizedHeaders(matrix.shift());
    assertUniqueHeaders(headers);
    const dateIndex = headers.indexOf('date');
    const salesIndex = headers.findIndex(value => ['sales', 'revenue', 'amount'].includes(value));
    const categoryIndex = headers.indexOf('category');
    if (dateIndex < 0 || salesIndex < 0) {
      throw new Error('CSV needs date and sales columns. Revenue or amount may be used instead of sales.');
    }

    const records = [];
    const dates = new Set();
    matrix.forEach((columns, offset) => {
      const rowNumber = offset + 2;
      const date = String(columns[dateIndex] || '').trim();
      const rawSales = String(columns[salesIndex] ?? '').trim();
      const category = categoryIndex >= 0 ? String(columns[categoryIndex] || '').trim() : '';
      if (!isValidISODate(date)) throw new Error(`Row ${rowNumber}: date must be a real YYYY-MM-DD date.`);
      if (!rawSales) throw new Error(`Row ${rowNumber}: sales cannot be blank.`);
      const sales = Number(rawSales.replace(/,/g, ''));
      if (!Number.isFinite(sales)) throw new Error(`Row ${rowNumber}: sales must be numeric.`);
      if (sales < 0) throw new Error(`Row ${rowNumber}: sales cannot be negative.`);
      if (dates.has(date)) throw new Error(`Row ${rowNumber}: duplicate date ${date}. Use one aggregated sales row per day.`);
      dates.add(date);
      records.push({ date, sales, category: category || 'General' });
    });
    records.sort((a, b) => a.date.localeCompare(b.date));
    if (records.length < minimumRows) throw new Error(`At least ${minimumRows} valid daily rows are required.`);
    return records;
  }

  function parseStockCSV(text, minimumRows = 20) {
    const matrix = parseDelimited(text);
    const headers = normalizedHeaders(matrix.shift());
    assertUniqueHeaders(headers);
    const dateIndex = headers.indexOf('date');
    const stockIndex = headers.findIndex(value => ['stock', 'close', 'stock_close'].includes(value));
    const benchmarkIndex = headers.findIndex(value => ['benchmark', 'benchmark_close', 'market', 'index'].includes(value));
    if (dateIndex < 0 || stockIndex < 0 || benchmarkIndex < 0) {
      throw new Error('CSV needs date, stock and benchmark columns.');
    }
    const dates = new Set();
    const records = matrix.map((columns, offset) => {
      const rowNumber = offset + 2;
      const date = String(columns[dateIndex] || '').trim();
      const rawStock = String(columns[stockIndex] ?? '').trim();
      const rawBenchmark = String(columns[benchmarkIndex] ?? '').trim();
      if (!isValidISODate(date)) throw new Error(`Row ${rowNumber}: date must be a real YYYY-MM-DD date.`);
      if (!rawStock || !rawBenchmark) throw new Error(`Row ${rowNumber}: stock and benchmark values are required.`);
      const stock = Number(rawStock.replace(/,/g, ''));
      const benchmark = Number(rawBenchmark.replace(/,/g, ''));
      if (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(benchmark) || benchmark <= 0) {
        throw new Error(`Row ${rowNumber}: stock and benchmark must be positive numbers.`);
      }
      if (dates.has(date)) throw new Error(`Row ${rowNumber}: duplicate date ${date}.`);
      dates.add(date);
      return { date, stock, benchmark };
    }).sort((a, b) => a.date.localeCompare(b.date));
    if (records.length < minimumRows) throw new Error(`At least ${minimumRows} valid market rows are required.`);
    return records;
  }

  function regression(data) {
    if (!Array.isArray(data) || data.length < 2) throw new Error('Regression requires at least two records.');
    const values = typeof data[0] === 'number' ? data : data.map(row => Number(row.sales));
    if (values.some(value => !Number.isFinite(value))) throw new Error('Regression received a non-numeric value.');
    const count = values.length;
    const xMean = (count - 1) / 2;
    const yMean = values.reduce((sum, value) => sum + value, 0) / count;
    let numerator = 0;
    let denominator = 0;
    values.forEach((value, index) => {
      numerator += (index - xMean) * (value - yMean);
      denominator += (index - xMean) ** 2;
    });
    const slope = denominator ? numerator / denominator : 0;
    return { slope, intercept: yMean - slope * xMean };
  }

  function forecast(data, horizon = 30, method = 'seasonal') {
    if (!Array.isArray(data) || data.length < 14) throw new Error('At least 14 daily rows are required to forecast.');
    if (!Number.isInteger(horizon) || horizon < 1 || horizon > 365) throw new Error('Forecast horizon must be between 1 and 365 days.');
    if (!['seasonal', 'moving', 'linear'].includes(method)) throw new Error('Unsupported forecast method.');
    const ordered = [...data].sort((a, b) => a.date.localeCompare(b.date));
    if (ordered.some(row => !isValidISODate(row.date) || !Number.isFinite(row.sales) || row.sales < 0)) {
      throw new Error('Forecast data contain an invalid date or sales value.');
    }
    const recent = ordered.slice(-Math.min(90, ordered.length));
    const fit = regression(recent);
    const factors = Array(7).fill(0);
    const counts = Array(7).fill(0);
    recent.forEach((row, index) => {
      const baseline = fit.intercept + fit.slope * index;
      if (Number.isFinite(baseline) && Math.abs(baseline) > 1e-9) {
        const day = weekdayUTC(row.date);
        const factor = row.sales / baseline;
        if (Number.isFinite(factor) && factor >= 0) {
          factors[day] += factor;
          counts[day] += 1;
        }
      }
    });
    factors.forEach((value, index) => {
      factors[index] = counts[index] ? value / counts[index] : 1;
    });
    const movingAverage = recent.slice(-7).reduce((sum, row) => sum + row.sales, 0) / Math.min(7, recent.length);
    const lastDate = ordered.at(-1).date;
    return Array.from({ length: horizon }, (_, index) => {
      const date = addDaysISO(lastDate, index + 1);
      let sales = fit.intercept + fit.slope * (recent.length + index);
      if (method === 'moving') sales = movingAverage;
      if (method === 'seasonal') sales *= factors[weekdayUTC(date)];
      if (!Number.isFinite(sales)) sales = 0;
      return { date, sales: Math.max(0, Math.round(sales)) };
    });
  }

  function evaluateForecast(data, method = 'seasonal', holdoutDays = 30) {
    if (!Array.isArray(data) || data.length < 21) return null;
    const holdout = Math.min(holdoutDays, Math.max(7, Math.floor(data.length / 4)));
    const training = data.slice(0, -holdout);
    if (training.length < 14) return null;
    const actual = data.slice(-holdout);
    const predicted = forecast(training, holdout, method);
    const calendarAligned = predicted.every((row, index) => row.date === actual[index].date);
    if (!calendarAligned) throw new Error('Forecast evaluation dates do not align with the holdout period.');
    const errors = predicted.map((row, index) => row.sales - actual[index].sales);
    const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / holdout;
    const rmse = Math.sqrt(errors.reduce((sum, error) => sum + error ** 2, 0) / holdout);
    const positive = actual.map((row, index) => [row.sales, errors[index]]).filter(([sales]) => sales > 0);
    const mape = positive.length
      ? positive.reduce((sum, [sales, error]) => sum + Math.abs(error) / sales, 0) / positive.length * 100
      : null;
    const bias = errors.reduce((sum, error) => sum + error, 0) / holdout;
    return { method, holdout, mae, rmse, mape, bias, calendarAligned };
  }

  function sampleSales() {
    const categories = ['Electronics', 'Home & Kitchen', 'Fashion', 'Grocery'];
    const start = '2026-02-01';
    return Array.from({ length: 180 }, (_, index) => {
      const date = addDaysISO(start, index);
      const weekly = [0.83, 0.9, 0.97, 1, 1.08, 1.26, 1.18][weekdayUTC(date)];
      const trend = 18500 + index * 52;
      const wave = Math.sin(index / 14) * 1200;
      return { date, sales: Math.round((trend + wave) * weekly), category: categories[index % categories.length] };
    });
  }

  function sampleStocks() {
    const result = [];
    let date = '2025-08-01';
    let stock = 128;
    let benchmark = 214;
    let index = 0;
    while (result.length < 260) {
      const day = weekdayUTC(date);
      if (day !== 0 && day !== 6) {
        stock *= 1.00065 + Math.sin(index / 15) * 0.0018 + Math.sin(index * 1.7) * 0.006;
        benchmark *= 1.00035 + Math.sin(index / 19) * 0.0012 + Math.sin(index * 1.3) * 0.0035;
        result.push({ date, stock: +stock.toFixed(2), benchmark: +benchmark.toFixed(2) });
        index += 1;
      }
      date = addDaysISO(date, 1);
    }
    return result;
  }

  return {
    addDaysISO,
    evaluateForecast,
    forecast,
    isValidISODate,
    parseDelimited,
    parseSalesCSV,
    parseStockCSV,
    regression,
    sampleSales,
    sampleStocks,
    weekdayUTC,
  };
});
