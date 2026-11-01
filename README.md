# ForecastIQ — Sales Forecasting and Business Performance Prediction System

ForecastIQ is a browser-based college macro project that accepts historical sales CSV data, validates it, forecasts future demand, visualizes trends, and generates an executive performance report.

## Run the project

1. Install Node.js 20 or later. On Windows, double-click `START_FORECASTIQ.bat` to start the complete website and open it in your browser. Alternatively, run `npm start` and visit `http://localhost:8765`.
2. Explore the public historical retail dataset, select a labeled demo, or click **Import data**.
3. Your CSV must contain `date` and `sales` columns. `category` is optional.

Opening `index.html` directly also works for sales analysis and uploaded stock CSVs. Chart.js is bundled locally, with a canvas fallback if it is unavailable. Live web-market retrieval requires the local server.

If **Stock performance** cannot retrieve prices, open the project with `START_FORECASTIQ.bat` and use `http://localhost:8765`. VS Code Live Server and GitHub Pages serve static files only and cannot run `/api/market`. For a hosted version with live prices, deploy the complete project to Vercel using `DEPLOY_TO_VERCEL.md`. You can still analyze `sample_stock_performance.csv` through the upload tab without a market connection.

## Features

- Executive overview with measured holdout error, priority signals and dataset context
- Responsive premium navigation, live data-quality context and one-click dashboard refresh
- KPI overview: revenue, daily average, growth and leading category
- CSV upload, drag-and-drop, validation and preview
- Linear trend, moving average, and trend-plus-weekly-seasonality forecasting
- Configurable 7–90 day forecast horizon
- Guided Forecast Studio with business presets, quick horizons, projected planning ranges and CSV export
- Side-by-side model benchmarking with chronological holdout MAE, RMSE, MAPE and bias
- Actual-versus-forecast and category charts
- Calendar-aligned chronological holdout MAE, RMSE, MAPE and bias evaluation
- Recommendations, printable report and CSV summary export
- Responsive layout for desktop and mobile
- Four realistic demo businesses spanning lifestyle retail, grocery, electronics and fashion
- Automatic dedicated company workspace after any business CSV upload
- Clearly labeled demo assumptions for orders, margins, targets and channels; these are hidden for real and uploaded datasets
- Luxury sign-in, registration, remembered-session, account menu and logout experience
- Stock performance analyzer with market-benchmark comparison
- Live NSE/BSE history for Indian symbols such as RELIANCE, TCS, INFY and HDFCBANK
- NIFTY 50, SENSEX, NIFTY BANK and NIFTY IT benchmark choices
- Return, annualized growth, volatility, maximum drawdown and relative-performance metrics
- Time-zone-safe forecast dates and calendar-aligned holdout evaluation
- Strict CSV validation for real dates, non-negative sales, required values and duplicate dates
- Offline canvas chart fallback when Chart.js is unavailable

## Dataset format

```csv
date,sales,category
2026-07-01,19250,Electronics
2026-07-02,18740,Home & Kitchen
```

Use real ISO dates (`YYYY-MM-DD`), non-negative numeric sales, one aggregated row per day, and at least 14 rows. Blank sales, malformed dates and duplicate dates are rejected with a row-specific message. Quoted CSV fields are supported.

### Stock-performance CSV

Use `date,stock,benchmark` columns containing at least 20 positive historical closing-price rows. The live option retrieves adjusted closing-price history through the local Node.js server. Market data can be delayed or temporarily unavailable. This module is educational and does not provide investment advice.

## Forecast design

The primary method fits ordinary least-squares linear regression to recent values and multiplies the trend estimate by average day-of-week seasonal factors. Forecast dates use UTC calendar arithmetic so they remain correct in India and other time zones. The Forecast Studio reports calendar-aligned chronological holdout MAE and MAPE when at least 21 records are available.

## Run automated checks

```powershell
npm ci
npm run test:model
npm run test:vercel
npm run test:ui
npm run test:data
npm run test:market
npm run test:charts
```

The suites validate forecasting, CSV parsing, source reconciliation, navigation, currency switching, uploaded-company views, market-provider failure and recovery, and API input handling. DOM checks use JSDOM with stubbed requests. Chart checks render the actual Chart.js configuration at mobile and desktop widths; they do not automate a browser.

## Project structure

- `index.html` — application screens and semantic structure
- `styles.css` — responsive visual design
- `core.js` — testable CSV validation, UTC date handling, forecasting and accuracy evaluation
- `app.js` — dashboard rendering, charts, reports and user interactions
- `chart-fallback.js` — offline canvas renderer used when Chart.js is unavailable
- `START_FORECASTIQ.bat` — one-click Windows launcher
- `sample_sales.csv` — upload-ready demonstration dataset
- `samples/Eternal_Ltd_Synthetic_Daily_Sales.csv` — 365-row company dataset for the dedicated business workspace
- `tests/model-tests.js` — automated logic checks
- `server.mjs` — local static server and market API routes
- `tests/premium-tests.cjs` — DOM checks for navigation, charts and uploaded data
- `tests/market-state-tests.cjs` — verified market data and provider-failure checks
- `samples/UCI_SOURCE.md` — public dataset attribution and transformation notes

## Deployment

The sales-only application can be deployed to a static host. Live `/api/market` and `/api/indices` routes require `server.mjs` locally or the included Vercel functions and will not work on static hosting alone. No database or secret key is required for the academic local demo; uploaded sales data remains in browser memory.

### Authentication scope

The included authentication is a fully interactive academic demonstration. Accounts and password hashes are stored in the current browser, and sessions can be remembered or cleared by signing out. For a real public production service, replace `auth.js` with server-side authentication or a managed identity service such as Supabase Auth, Firebase Authentication, Auth0 or Clerk; use HTTPS, secure cookies, email verification, rate limiting and password recovery.

## Academic note

Replace student/college placeholders in the reports before submission. The forecast is a decision-support estimate and must be evaluated with business-specific data.

## Public historical sales data

The default workspace uses real UCI Online Retail transactions, aggregated to daily gross merchandise sales from January 1 to November 30, 2011. Values remain in GBP. Returns, cancellations, postage, fees and adjustments are excluded. Days with no qualifying recorded sales are explicit zeros, not interpolated values. These are historical observations, not a live business feed. See [source, attribution, exclusions and reconciliation](samples/UCI_SOURCE.md). Synthetic businesses remain available as clearly labeled demos.

Page options are always visible in a horizontal navigation bar at the top. On narrow screens the same bar scrolls horizontally. The Data manager provides source links, a downloadable daily CSV, and currency selection for uploads. Indian market prices are fetched through the local API, and the app hides unverified charts while waiting or when the provider fails.

Additional checks: `npm run test:ui`, `npm run test:data`, `npm run test:market`, and `npm run test:charts`. The last command renders the actual Chart.js sales and country charts at 360px and 900px into `.runtime/qa/chart-renders`.
