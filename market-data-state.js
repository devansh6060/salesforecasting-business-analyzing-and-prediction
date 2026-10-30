(function () {
  'use strict';
  const workspace = document.getElementById('stocks');
  let verified = false;
  let attempted = false;
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
    if (fetchMarketBtn.disabled) return;
    attempted = true; verified = false;
    workspace.classList.add('market-awaiting-data');
    currentMarketPayload = null;
    quoteCompany.textContent = 'Loading verified price history';
    quoteTicker.textContent = 'Yahoo Finance · request in progress';
    quotePrice.textContent = '—'; quoteChange.textContent = '';
    quotePrevious.textContent = quoteRange.textContent = quoteVolume.textContent = '—';
    quoteTimestamp.textContent = 'Waiting for provider response';
    quoteMarketState.textContent = 'LOADING';
    await baseFetch();
    if (!verified) {
      quoteCompany.textContent = 'Market data unavailable';
      quoteTicker.textContent = 'Retry Search when the provider is available';
      quoteMarketState.textContent = 'UNAVAILABLE';
      quoteTimestamp.textContent = 'No verified response';
      marketMeta.textContent = 'The provider did not return valid history. No simulated prices are displayed.';
      marketStatus.textContent = marketStatus.textContent.replace('Make sure server.py is running and internet is available.', 'Check the local server and internet connection, then retry.');
    }
  };
  fetchMarketBtn.onclick = fetchMarketData;
  stockResetBtn.textContent = 'Refresh market data';
  stockResetBtn.onclick = fetchMarketData;
  document.querySelector('.nav[data-view="stocks"]').addEventListener('click', () => { if (!attempted) fetchMarketData(); });
  loadStockFile = function (file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseStockCSV(reader.result);
        stockData = parsed; currentMarketPayload = null; verified = true;
        workspace.classList.remove('market-awaiting-data');
        quoteCompany.textContent = 'Uploaded comparison data';
        quoteTicker.textContent = 'Your CSV · prices not independently verified';
        quoteExchange.textContent = 'CSV';
        quotePrice.textContent = '—'; quoteChange.textContent = 'Source: uploaded file';
        quotePrevious.textContent = quoteRange.textContent = quoteVolume.textContent = '—';
        quoteMarketState.textContent = 'UPLOADED'; quoteTimestamp.textContent = `${parsed[0].date} to ${parsed.at(-1).date}`;
        renderStocks();
        marketMeta.textContent = `Uploaded CSV · ${parsed.length} comparison sessions · price fields assumed INR`;
        chartHeading.textContent = 'Uploaded stock vs benchmark';
        marketStatus.textContent = 'Uploaded prices displayed. Select Search to replace them with provider data.';
        marketStatus.className = 'market-status success';
      } catch (error) { toastMsg(error.message); }
    };
    reader.readAsText(file);
  };
})();
