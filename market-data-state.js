(function () {
  'use strict';
  const workspace = document.getElementById('stocks');
  let verified = false;
  let attempted = false;
  let fetching = false;
  let pendingSearch = null;
  const renderLoadedStocks = renderStocks;
  renderStocks = function () {
    if (!verified) return;
    renderLoadedStocks();
    if (!currentMarketPayload) chartHeading.textContent = 'Uploaded stock vs benchmark';
  };
  stockData = [];
  workspace.classList.add('market-awaiting-data');
  quoteCompany.textContent = 'Search an Indian listed company';
  quoteTicker.textContent = 'NSE / BSE · historical closing prices';
  chartHeading.textContent = 'Stock vs benchmark';
  marketMeta.textContent = 'No market history loaded';
  stockPeriod.textContent = 'Dates appear after a successful request';
  quoteExchange.textContent = 'MARKET';
  quoteMarketState.textContent = 'AWAITING DATA';
  const baseLiveQuote = renderLiveQuote;
  renderLiveQuote = function (payload) {
    baseLiveQuote(payload);
    verified = true;
    workspace.classList.remove('market-awaiting-data');
    quoteTimestamp.textContent = `${new Date(payload.fetchedAt).toLocaleString('en-IN')} · latest session ${payload.data.at(-1).date}`;
  };
  const baseFetch = fetchMarketData;
  fetchMarketData = async function () {
    if (fetching) {
      pendingSearch = { symbol: stockSymbol.value, exchange: stockExchange.value, benchmark: benchmarkSymbol.value, range: stockRange.value };
      return;
    }
    if (fetchMarketBtn.disabled) return;
    if (!/^[A-Z0-9&-]{1,15}$/.test(stockSymbol.value.trim().toUpperCase().replace(/\.(NS|BO)$/, ''))) {
      marketStatus.textContent = 'Enter a valid symbol such as RELIANCE, TCS or INFY.';
      marketStatus.className = 'market-status error';
      return;
    }
    fetching = true;
    stockSearchResults.classList.remove('open');
    attempted = true; verified = false;
    workspace.classList.add('market-awaiting-data');
    currentMarketPayload = null;
    quoteCompany.textContent = 'Loading verified price history';
    quoteTicker.textContent = 'Yahoo Finance · request in progress';
    quotePrice.textContent = '—'; quoteChange.textContent = '';
    quotePrevious.textContent = quoteRange.textContent = quoteVolume.textContent = '—';
    quoteTimestamp.textContent = 'Waiting for provider response';
    quoteMarketState.textContent = 'LOADING';
    stockPeriod.textContent = 'Waiting for price history';
    stockFileInput.disabled = true;
    analyzeStockBtn.disabled = true;
    try { await baseFetch(); }
    finally { fetching = false; stockFileInput.disabled = false; analyzeStockBtn.disabled = false; }
    if (!verified) {
      quoteCompany.textContent = 'Market data unavailable';
      quoteTicker.textContent = 'Retry Search when the provider is available';
      quoteMarketState.textContent = 'UNAVAILABLE';
      quoteTimestamp.textContent = 'No verified response';
      marketMeta.textContent = 'The provider did not return valid history. No simulated prices are displayed.';
      stockPeriod.textContent = 'No market history loaded';
      marketStatus.textContent = marketStatus.textContent.replace('Make sure server.py is running and internet is available.', 'Check the local server and internet connection, then retry.');
    }
    if (pendingSearch) {
      const next = pendingSearch;
      pendingSearch = null;
      stockSymbol.value = next.symbol;
      stockExchange.value = next.exchange;
      benchmarkSymbol.value = next.benchmark;
      stockRange.value = next.range;
      await fetchMarketData();
    }
  };
  fetchMarketBtn.onclick = fetchMarketData;
  stockResetBtn.textContent = 'Refresh market data';
  stockResetBtn.onclick = fetchMarketData;
  document.querySelector('.nav[data-view="stocks"]').addEventListener('click', () => { if (!attempted || !verified) fetchMarketData(); });
  // Refresh provider prices while this section is visible. Never replace an uploaded CSV.
  setInterval(() => {
    if (!document.hidden && workspace.classList.contains('active') && currentMarketPayload && !fetchMarketBtn.disabled) {
      fetchMarketData();
      loadIndices();
    }
  }, 60000);
  analyzeStockBtn.onclick = () => {
    const file = stockFileInput.files[0];
    if (file) loadStockFile(file);
    else {
      marketStatus.textContent = 'Choose a price CSV first, or select Search to load market data.';
      marketStatus.className = 'market-status error';
      stockFileInput.click();
    }
  };
  loadStockFile = function (file) {
    if (fetchMarketBtn.disabled) return;
    // Keep a live request from replacing a file while FileReader is working.
    fetchMarketBtn.disabled = true;
    analyzeStockBtn.disabled = true;
    const reader = new FileReader();
    const finish = () => { fetchMarketBtn.disabled = false; analyzeStockBtn.disabled = false; };
    reader.onerror = () => {
      finish();
      marketStatus.textContent = 'Unable to read this file. Choose the CSV again.';
      marketStatus.className = 'market-status error';
    };
    reader.onload = () => {
      try {
        const parsed = parseStockCSV(reader.result);
        stockData = parsed; currentMarketPayload = null; verified = true; attempted = true;
        workspace.classList.remove('market-awaiting-data');
        quoteCompany.textContent = 'Uploaded comparison data';
        quoteTicker.textContent = 'Your CSV · prices not independently verified';
        quoteExchange.textContent = 'CSV';
        quoteHero.className = 'quote-hero';
        quotePrice.textContent = marketMoney(parsed.at(-1).stock);
        quotePrevious.textContent = marketMoney(parsed.at(-2).stock);
        const change = (parsed.at(-1).stock / parsed.at(-2).stock - 1) * 100;
        quoteChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}% · uploaded file`;
        quoteChange.className = change >= 0 ? 'positive' : 'negative';
        quoteRange.textContent = quoteVolume.textContent = '—';
        quoteMarketState.textContent = 'UPLOADED'; quoteTimestamp.textContent = `${parsed[0].date} to ${parsed.at(-1).date}`;
        renderStocks();
        marketMeta.textContent = `Uploaded CSV · ${parsed.length} comparison sessions · price fields assumed INR`;
        chartHeading.textContent = 'Uploaded stock vs benchmark';
        marketStatus.textContent = 'Uploaded prices displayed. Select Search to replace them with provider data.';
        marketStatus.className = 'market-status success';
        document.querySelector('[data-market-tab="overview"]').click();
        requestAnimationFrame(() => charts.stockChart?.resize?.());
      } catch (error) {
        marketStatus.textContent = error.message;
        marketStatus.className = 'market-status error';
        toastMsg(error.message);
      } finally { finish(); }
    };
    reader.readAsText(file);
  };
})();
