let candleData = [];
let allMarketsList = [];
const API_KEY = "2d861128d51349ec952f709b9d504476";
let currentTimeframe = "1min"; // default
let currentSymbol = "AAPL"; // default
let lineColor = "#ff0000";
let lineWidth = 2;
let candleSeries;
let chart;
const overlaySeriesByKey = new Map();
const subBlocks = new Map();
const logoCache = new Map();

// ------------------- LOGO -------------------
async function fetchLogo(symbol) {
  if (!symbol) return null;
  if (logoCache.has(symbol)) return logoCache.get(symbol);
  try {
    const url = `https://api.twelvedata.com/logo?symbol=${symbol}&apikey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const logoUrl = (data && data.logo_base) ? data.logo_base : "https://logo.twelvedata.com/crypto/usd.png";
    logoCache.set(symbol, logoUrl);
    return logoUrl;
  } catch (err) {
    console.warn("Logo fetch error for", symbol, err);
    return "https://logo.twelvedata.com/crypto/usd.png";
  }
}

// ------------------- MERCATI -------------------
async function loadMarketsList() {
  try {
    let tempList = [];
    for (const market of ['stocks', 'cryptocurrencies', 'forex_pairs', 'etfs', 'commodities']) {
      const url = `https://api.twelvedata.com/${market}?apikey=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        switch (market) {
          case 'stocks':
            data.data.forEach(d => {
              tempList.push({
                symbol: d.symbol || d.currency || "",
                type: "stock",
                name: d.name || ""
              });
            });
            break;
          case 'forex_pairs':
            data.data.forEach(d => {
              tempList.push({
                symbol: d.symbol || "",
                name: d.currency_group || "",
                type: "forex"
              });
            });
            break;
          case 'cryptocurrencies':
            data.data.forEach(d => {
              tempList.push({
                symbol: d.symbol || "",
                name: d.currency_base || "",
                type: "crypto",
              });
            });
            break;
          case 'etfs':
            data.data.forEach(d => {
              tempList.push({
                symbol: d.symbol || "",
                name: d.name || "",
                type: "etf",
              });
            });
            break;
          case 'commodities':
            data.data.forEach(d => {
              tempList.push({
                symbol: d.symbol || "",
                name: d.name || "",
                type: "commodity"
              });
            });
            break;
        }
      }
    }
    allMarketsList = tempList;
    console.log("Mercati caricati:", allMarketsList.length);
  } catch (err) {
    console.error("Errore caricamento mercati:", err);
  }
}
loadMarketsList();

// ------------------- INDICATORI -------------------
function refreshIndicators() {
  overlaySeriesByKey.forEach((series, indKey) => {
    removeSeriesFromChart(chart, series);
    overlaySeriesByKey.delete(indKey);
    addOverlayIndicator(indKey, indKey.toUpperCase());
  });
  subBlocks.forEach((payload, indKey) => {
    payload.wrap.remove();
    subBlocks.delete(indKey);
    addBottomIndicator(indKey, indKey.toUpperCase());
  });
}

async function fetchCandles(symbol, interval) {
  let url = `https://api.twelvedata.com/time_series?apikey=${API_KEY}&interval=${interval}&symbol=${symbol}&outputsize=500`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data && Array.isArray(data.values)) {
      const mapped = data.values.map(c => ({
        time: Math.floor(new Date(c.datetime).getTime() / 1000),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: c.volume !== undefined ? parseFloat(c.volume) : 0
      }));
      return mapped.reverse();
    } else {
      console.error("Errore nella risposta API:", data);
      return [];
    }
  } catch (err) {
    console.error('fetchCandles error:', err);
    return [];
  }
}

function resizeMain(chart, container) {
  chart.applyOptions({
    width: container.clientWidth,
    height: container.clientHeight,
  });
}

async function reloadCandles() {
  if (!currentSymbol) return;
  const data = await fetchCandles(currentSymbol, currentTimeframe);
  candleData = Array.isArray(data) ? data : [];
  if (candleSeries) candleSeries.setData(candleData);
  refreshIndicators();
}

// ---------------- FUNZIONI INDICATORI ----------------
function calcSMA(data, period = 14) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const out = data.map((d, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    return { time: d.time, value: sum / period };
  });
  return out.filter(Boolean);
}

function calcEMA(data, period = 14) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const k = 2 / (period + 1);
  let emaPrev = data[0].close;
  const out = data.map((d, i) => {
    if (i === 0) return { time: d.time, value: emaPrev };
    const ema = d.close * k + emaPrev * (1 - k);
    emaPrev = ema;
    return { time: d.time, value: ema };
  });
  return out.filter(Boolean);
}

function calcBollingerBands(data, period = 20, mult = 2) {
  if (!Array.isArray(data) || data.length === 0) return [];
  let sum = 0, sqsum = 0;
  const out = data.map((d, i) => {
    const c = d.close;
    sum += c; sqsum += c * c;
    if (i >= period) {
      const old = data[i - period].close;
      sum -= old; sqsum -= old * old;
    }
    if (i >= period - 1) {
      const mean = sum / period;
      const variance = Math.max((sqsum / period) - mean * mean, 0);
      const std = Math.sqrt(variance);
      return { time: d.time, upper: mean + mult * std, middle: mean, lower: mean - mult * std };
    }
    return null;
  });
  return out.filter(Boolean);
}

function calcParabolicSAR(data, step = 0.02, maxStep = 0.2) {
  if (!Array.isArray(data) || data.length === 0) return [];
  let out = [];
  let isUptrend = true;
  let af = step;
  let ep = data[0].high;
  let sar = data[0].low;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      out.push({ time: data[i].time, value: sar });
      continue;
    }
    sar = sar + af * (ep - sar);
    if (isUptrend) {
      if (data[i].low < sar) {
        isUptrend = false;
        sar = ep; ep = data[i].low; af = step;
      } else if (data[i].high > ep) {
        ep = data[i].high; af = Math.min(af + step, maxStep);
      }
    } else {
      if (data[i].high > sar) {
        isUptrend = true; sar = ep; ep = data[i].high; af = step;
      } else if (data[i].low < ep) {
        ep = data[i].low; af = Math.min(af + step, maxStep);
      }
    }
    out.push({ time: data[i].time, value: sar });
  }
  return out;
}

function calcIchimokuCloud(data) {
  if (!Array.isArray(data) || data.length === 0) return { conversion: [], base: [], spanA: [], spanB: [], lagging: [] };
  let conversion = [], base = [], spanA = [], spanB = [], lagging = [];

  for (let i = 0; i < data.length; i++) {
    if (i >= 8) {
      let slice = data.slice(i - 8, i + 1);
      let high = Math.max(...slice.map(d => d.high));
      let low = Math.min(...slice.map(d => d.low));
      conversion.push({ time: data[i].time, value: (high + low) / 2 });
    } else conversion.push(null);

    if (i >= 25) {
      let slice = data.slice(i - 25, i + 1);
      let high = Math.max(...slice.map(d => d.high));
      let low = Math.min(...slice.map(d => d.low));
      base.push({ time: data[i].time, value: (high + low) / 2 });
    } else base.push(null);

    lagging.push(i >= 26 ? { time: data[i - 26].time, value: data[i].close } : null);

    if (i >= 25) {
      let convVal = conversion[i] ? conversion[i].value : 0;
      let baseVal = base[i] ? base[i].value : 0;
      spanA.push({ time: data[i].time, value: (convVal + baseVal) / 2 });
    } else spanA.push(null);

    if (i >= 51) {
      let slice = data.slice(i - 51, i + 1);
      let high = Math.max(...slice.map(d => d.high));
      let low = Math.min(...slice.map(d => d.low));
      spanB.push({ time: data[i].time, value: (high + low) / 2 });
    } else spanB.push(null);
  }

  return {
    conversion: conversion.filter(Boolean),
    base: base.filter(Boolean),
    spanA: spanA.filter(Boolean),
    spanB: spanB.filter(Boolean),
    lagging: lagging.filter(Boolean)
  };
}

function calcRSI(data, period = 14) {
  if (!Array.isArray(data) || data.length === 0) return [];
  let gains = 0, losses = 0;
  const res = new Array(data.length).fill(null);

  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);

    if (i <= period) {
      gains += gain; losses += loss;
      if (i === period) {
        const avgG = gains / period; const avgL = losses / period;
        const rs = avgL === 0 ? 100 : avgG / avgL;
        res[i] = { time: data[i].time, value: 100 - 100 / (1 + rs) };
      }
    } else {
      gains = (gains * (period - 1) + gain) / period;
      losses = (losses * (period - 1) + loss) / period;
      const rs = losses === 0 ? 100 : gains / losses;
      res[i] = { time: data[i].time, value: 100 - 100 / (1 + rs) };
    }
  }
  return res.filter(Boolean);
}

function calcMACD(data, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  if (!Array.isArray(data) || data.length === 0) return { macdLine: [], signalLine: [], histogram: [] };
  const emaShort = calcEMA(data, shortPeriod).map(e => e.value);
  const emaLong = calcEMA(data, longPeriod).map(e => e.value);

  const macdLine = data.map((d, i) => (emaShort[i] != null && emaLong[i] != null ? emaShort[i] - emaLong[i] : null));
  const macdData = macdLine.map((v, i) => ({ time: data[i].time, close: v ?? 0 }));
  const signalLine = calcEMA(macdData, signalPeriod).map(e => e.value);
  const histogram = macdLine.map((val, i) => (val != null && signalLine[i] != null ? val - signalLine[i] : null));

  return {
    macdLine: macdLine.map((v, i) => (v != null ? { time: data[i].time, value: v } : null)).filter(Boolean),
    signalLine: signalLine.map((v, i) => (v != null ? { time: data[i].time, value: v } : null)).filter(Boolean),
    histogram: histogram.map((v, i) => (v != null ? { time: data[i].time, value: v } : null)).filter(Boolean)
  };
}

function calcATR(data, period = 14) {
  if (!Array.isArray(data) || data.length === 0) return [];
  let trs = [null];
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high; const low = data[i].low; const prevClose = data[i - 1].close;
    trs[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  const out = data.map((d, i) => {
    if (i < period) return null;
    const slice = trs.slice(i - period + 1, i + 1);
    const atr = slice.reduce((a, b) => a + b, 0) / period;
    return { time: d.time, value: atr };
  });
  return out.filter(Boolean);
}

function calcStochastic(data, kPeriod = 14, dPeriod = 3) {
  if (!Array.isArray(data) || data.length === 0) return { k: [], d: [] };
  let k = [], d = [];
  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) { k.push(null); d.push(null); continue; }
    const slice = data.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const close = data[i].close;
    const kValue = ((close - low) / (high - low)) * 100;
    k.push(kValue);
    if (i >= kPeriod - 1 + dPeriod - 1) {
      const dSlice = k.slice(-dPeriod);
      d.push(dSlice.reduce((a, b) => a + b, 0) / dPeriod);
    } else d.push(null);
  }
  return {
    k: k.map((v, i) => (v != null ? { time: data[i].time, value: v } : null)).filter(Boolean),
    d: d.map((v, i) => (v != null ? { time: data[i].time, value: v } : null)).filter(Boolean)
  };
}

function calcCCI(data, period = 20) {
  if (!Array.isArray(data) || data.length === 0) return [];
  const out = data.map((d, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const typicalPrices = slice.map(c => (c.high + c.low + c.close) / 3);
    const tp = typicalPrices[typicalPrices.length - 1];
    const sma = typicalPrices.reduce((a, b) => a + b, 0) / period;
    const meanDev = typicalPrices.reduce((a, b) => a + Math.abs(b - sma), 0) / period;
    return { time: d.time, value: meanDev === 0 ? 0 : (tp - sma) / (0.015 * meanDev) };
  });
  return out.filter(Boolean);
}

function calcVolume(data) {
  if (!Array.isArray(data) || data.length === 0) return [];
  return data.map(d => ({ time: d.time, value: d.volume }));
}


function openSettings( indName) {
  const modal = document.createElement("div");
  modal.style = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    background:#fff; border:1px solid #ccc; border-radius:8px; padding:16px;
    box-shadow:0 4px 12px rgba(0,0,0,0.15); z-index:9999; color:black;
  `;
  modal.innerHTML = `
    <h4 style="margin-top:0">${indName} - Impostazioni</h4>
    <label>Periodo: <input type="number" value="14" /></label>
    <div style="margin-top:12px; text-align:right;">
      <button id="closeModal">Chiudi</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#closeModal").onclick = () => modal.remove();
}

function removeSeriesFromChart(chartRef, item) {
  if (!chartRef || !item) return;
  if (Array.isArray(item)) { item.forEach(i => removeSeriesFromChart(chartRef, i)); return; }
  if (item instanceof Map) { Array.from(item.values()).forEach(i => removeSeriesFromChart(chartRef, i)); return; }
  if (typeof item === 'object') {
    if (typeof item.setData === 'function' || typeof item.update === 'function' || typeof item.applyOptions === 'function') {
      try { chartRef.removeSeries(item); } catch (err) { console.warn('removeSeries failed:', err); }
      return;
    }
    Object.values(item).forEach(v => removeSeriesFromChart(chartRef, v));
    return;
  }
}





// ------------------- INIT CHART & UI -------------------
function initChart(container) {
  container.innerHTML = "";
  container.style.position = "relative";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.height = "100%";
  container.style.width = "100%";

  // Toolbar
  const toolbar = document.createElement("div");
  toolbar.style = `
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding:8px 12px;
    border-bottom:1px solid #e0e0e0;
    background:#fafafa;
    flex:0 0 auto;
  `;

  // Left tools
  const toolsLeft = document.createElement("div");
  toolsLeft.style = `display:flex; gap:8px; align-items:center; position:relative;`;

  const toolBtns = [
    { icon: "fa-pen", title: "Disegni" },
    { icon: "fa-font", title: "Note testuali" },
    { icon: "fa-bars", title: "Strumenti (es. Fibonacci)" }
  ];

  toolBtns.forEach(t => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = t.title;
    btn.style = `border:1px solid #ddd; background:#fff; border-radius:6px; padding:6px 10px; cursor:pointer;`;
    btn.innerHTML = `<i class="fa-solid ${t.icon}"></i>`;
    btn.onmouseover = () => btn.style.background = "#f0f0f0";
    btn.onmouseout = () => btn.style.background = "#fff";
    if (t.title === "Disegni") {
      btn.id = "btn-disegni";
      btn.setAttribute("aria-expanded", "false");
    }
    toolsLeft.appendChild(btn);
  });

  // Submenu disegni
  const drawMenu = document.createElement("div");
  drawMenu.style = `
    position:absolute;
    top:calc(100% + 8px);
    left:0;
    background:#fff;
    border:1px solid #ddd;
    border-radius:8px;
    box-shadow:0 6px 18px rgba(0,0,0,0.12);
    display:none;
    flex-direction:column;
    z-index:3000;
    min-width:180px;
    padding:6px;
  `;
  const ToolsList = [
    { key: "line", label: "Linea", icon: "fa-slash" },
    { key: "rect", label: "Rettangolo", icon: "fa-square" },
    { key: "circle", label: "Cerchio", icon: "fa-circle" },
    { key: "arrow", label: "Freccia", icon: "fa-arrow-right" },
    { key: "pointer", label: "Puntatore", icon: "fa-mouse-pointer" },
  ];
  ToolsList.forEach(t => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "draw-menu-item";
    item.style = `display:flex; align-items:center; gap:8px; padding:8px; border:none; background:transparent; cursor:pointer; width:100%; text-align:left;`;
    item.innerHTML = `<i class="fa-solid ${t.icon}" style="width:18px;"></i><span>${t.label}</span>`;
    item.dataset.tool = t.key;

    item.addEventListener("click", () => {
      currentTool = t.key;
   
      document.querySelectorAll(".draw-menu-item").forEach(b => b.style.background = "transparent");
      item.style.background = "#e0e0e0";
      drawMenu.style.display = "none";
      const btn = document.getElementById("btn-disegni");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });

    item.onmouseover = () => item.style.background = "#f5f5f5";
    item.onmouseout = () => item.style.background = "transparent";
    drawMenu.appendChild(item);
  });
  toolsLeft.appendChild(drawMenu);


  

  // Bottone Disegni
  const btnDisegni = toolsLeft.querySelector("button#btn-disegni");
  if (btnDisegni) {
    btnDisegni.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = drawMenu.style.display === "flex";
      drawMenu.style.display = isOpen ? "none" : "flex";
      btnDisegni.setAttribute("aria-expanded", String(!isOpen));
    });
  } else {
    console.warn("Bottone 'Disegni' non trovato - controlla il blocco toolbar.");
  }
  document.addEventListener("click", (ev) => {
    if (!toolsLeft.contains(ev.target)) {
      drawMenu.style.display = "none";
      const btn = document.getElementById("btn-disegni");
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
  });

  // ------------------- BARRA RICERCA MERCATI -------------------
  const marketSearchWrap = document.createElement("div");
  marketSearchWrap.style = `
    position:relative;
    width:260px;
    max-width:40vw;
    flex:1 1 auto;
  `;
  const marketIcon = document.createElement("i");
  marketIcon.className = "fa-solid fa-magnifying-glass";
  marketIcon.style = `
    position:absolute;
    left:10px;
    top:50%;
    transform:translateY(-50%);
    color:#888;
    pointer-events:none;
  `;
  const marketInput = document.createElement("input");
  marketInput.type = "text";
  marketInput.placeholder = "Cerca mercato";
  marketInput.style = `
    width:100%;
    border:1px solid #ddd;
    border-radius:6px;
    padding:10px 10px 10px 32px;
    outline:none;
    background:#fff;
    font-size:15px;
  `;
  const resultsDropdown = document.createElement("div");
  resultsDropdown.style = `
    position: absolute;
    left: 0;
    top: 40px;
    width: 100%;
    max-height: 220px;
    overflow-y: auto;
    z-index: 2001;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 0 0 8px 8px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    font-size: 14px;
    color: black;
    display: none;
  `;
  marketSearchWrap.appendChild(marketIcon);
  marketSearchWrap.appendChild(marketInput);
  marketSearchWrap.appendChild(resultsDropdown);

  // Timeframe selector
  const timeframeWrap = document.createElement("select");
  timeframeWrap.style = `border:1px solid #ddd; background:#fff; border-radius:6px; padding:8px 14px; cursor:pointer; flex:0 0 auto; margin-left:8px;`;
  const timeframes = [
    { label: "1m", value: "1min" },
    { label: "5m", value: "5min" },
    { label: "15m", value: "15min" },
    { label: "1h", value: "1h" },
    { label: "D", value: "1day" },
    { label: "W", value: "1week" },
    { label: "M", value: "1month" },
  ];
  timeframes.forEach(tf => {
    const optT = document.createElement("option");
    optT.value = tf.value;
    optT.textContent = tf.label;
    timeframeWrap.appendChild(optT);
  });
  timeframeWrap.addEventListener('change', async () => {
    currentTimeframe = timeframeWrap.value;
    await reloadCandles();
  });

  // Indicator select
  const indicatorSelect = document.createElement("select");
  indicatorSelect.style = `border:1px solid #ddd; background:#fff; border-radius:6px; padding:8px 14px; cursor:pointer; flex:0 0 auto; margin-left:8px;`;
  indicatorSelect.innerHTML = `<option value="" selected disabled>Aggiungi indicatore</option>`;

  toolbar.appendChild(toolsLeft);
  toolbar.appendChild(marketSearchWrap);
  toolbar.appendChild(timeframeWrap);
  toolbar.appendChild(indicatorSelect);

  // Chart area
  const chartArea = document.createElement("div");
  chartArea.style = `
    position:relative;
    flex:1 1 auto; min-height:240px;
    background:#fff;
    border:1px solid #eee;
    border-radius:8px;
  `;
  const overlayBox = document.createElement("div");
  overlayBox.style = `
    font-size:13px;
    pointer-events:none;
    display:flex;
    gap:30px;
  `;
  chartArea.appendChild(overlayBox);

  const indicatorsOverlay = document.createElement("div");
  indicatorsOverlay.style = `position:absolute; left:10px; top:10px; display:flex; gap:6px; flex-wrap:wrap; z-index:10; pointer-events:none;`;
  overlayBox.appendChild(indicatorsOverlay);

  const subIndicatorsSection = document.createElement("div");
  subIndicatorsSection.style = `display:flex; flex-direction:column; gap:8px; flex:0 0 auto;`;

  container.appendChild(toolbar);
  container.appendChild(chartArea);
  container.appendChild(subIndicatorsSection);
  container._chartArea = chartArea;

  // Chart (Lightweight)
  chart = LightweightCharts.createChart(chartArea, {
    width: chartArea.clientWidth,
    height: chartArea.clientHeight,
    layout: { background: { color: "#ffffff" }, textColor: "#333" },
    priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: true },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    watermark: { visible: false },
    grid: { vertLines: { color: "#f2f2f2" }, horzLines: { color: "#f2f2f2" } },
  });
  container._chart = chart;
  candleSeries = chart.addCandlestickSeries();

  reloadCandles();
  setInterval(reloadCandles, 60000);

  // ------------------- CHART HEADER -------------------
  const toolTip = document.createElement('div');
  toolTip.className = 'tooltip';
  toolTip.style = `
    position:absolute;
    top:10px;
    left:10px;
    padding:6px 10px;
    font-size:13px;
    pointer-events:none;
    z-index:1000;
    color:black;
    display:flex;
    align-items:center;
    gap:10px;
  `;
  const img = document.createElement("img");
  img.style = "width:18px; height:18px; object-fit:contain; border-radius:3px;";
  const symbol = document.createElement("span");
  symbol.style = "font-weight:bold;";
  const toolOHLC = document.createElement("span");
  toolOHLC.textContent = "O: - | H: - | L: - | C: -";
  toolTip.appendChild(img);
  toolTip.appendChild(symbol);
  toolTip.appendChild(toolOHLC);
  overlayBox.appendChild(toolTip);

  // Funzione per aggiornare logo e simbolo
  async function updateTooltipSymbol() {
    symbol.textContent = currentSymbol;

    const url = await fetchLogo(currentSymbol);
    if (url) img.src = url;
  }
  updateTooltipSymbol();



  let currentFilter = "all"; // filtro di ricerca

  // ------------------------------
  // Header bottoni filtro
  // ------------------------------
  const header = document.createElement("div");
  header.style = `
    font-size: 14px;
    font-weight: bold;
    color:#444;
    display: flex;
    justify-content: center; 
    gap: 10px;
    align-items: center;
    padding: 6px;
  `;

  // stile bottoni
  const buttonStyle = `
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 15px;
    color: #333;
    cursor: pointer;
    font-size: 13px;
    padding: 6px 14px;
    margin: 0 2px;
    transition: background 0.2s, border-color 0.2s;
  `;

  // Utility creazione bottoni
  function createButton(label, filterType) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style = buttonStyle;
    btn.onmouseover = () => (btn.style.background = "#e0e0e0");
    btn.onmouseout = () => (btn.style.background = "#fff");
    btn.onclick = () => setFilter(filterType);
    return btn;
  }

  // Bottoni
  const button_Tl = createButton("Tutto", "all");
  const button_Fx = createButton("Forex", "forex");
  const button_Ix = createButton("Index", "stock"); 
  const button_Cp = createButton("Crypto", "crypto");
  const button_Et = createButton("ETF", "etf");
  const button_Cm = createButton("Commodity", "commodity");

  header.appendChild(button_Tl);
  header.appendChild(button_Fx);
  header.appendChild(button_Ix);
  header.appendChild(button_Cp);
  header.appendChild(button_Et);
  header.appendChild(button_Cm);

  resultsDropdown.appendChild(header);

  // ------------------------------
  // Utility creazione item dropdown
  // ------------------------------
  function createDropdownItem(m) {
    const item = document.createElement("div");
    item.style = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      cursor: pointer;
      font-size: 15px;

    `;
    item.onmouseover = () => (item.style.background = "#f5f5f5");
    item.onmouseout = () => (item.style.background = "transparent");
    item.onclick = async () => {
      currentSymbol = m.symbol;
      await reloadCandles();
      updateTooltipSymbol();
      resultsDropdown.style.display = "none";
      marketInput.value = `${m.symbol}`;
    };

    const marketType = m.exchange || m.type || "";
    const description = m.name || "";
    const text = document.createElement("span");
    text.innerHTML = `<b>${m.symbol}</b> (${marketType}) - <span style="color:#888">${description}</span>`;

    item.appendChild(text);
    return item;
  }

  // ------------------------------
  // Funzione filtro globale
  // ------------------------------
  function setFilter(filterType) {
    currentFilter = filterType;
    resultsDropdown.innerHTML = "";
    resultsDropdown.appendChild(header);

    let filtered = allMarketsList;
    if (filterType !== "all") {
      filtered = allMarketsList.filter(m => m.type.toLowerCase() === filterType);
    }

    filtered.slice(0, 30).forEach(m => {
      resultsDropdown.appendChild(createDropdownItem(m));
    });

    resultsDropdown.style.display = "block";
  }

  // ------------------------------
  // Ricerca mercati
  // ------------------------------
  marketInput.addEventListener("input", () => {
    const query = marketInput.value.toLowerCase().trim();
    resultsDropdown.innerHTML = "";
    resultsDropdown.appendChild(header);

    let filtered = allMarketsList;

    // applica filtro categoria
    if (currentFilter !== "all") {
      filtered = filtered.filter(m => m.type.toLowerCase() === currentFilter);
    }

    // applica ricerca
    if (query) {
      filtered = filtered.filter(m =>
        m.symbol.toLowerCase().includes(query) ||
        (m.name && m.name.toLowerCase().includes(query)) ||
        (m.exchange && m.exchange.toLowerCase().includes(query))
      );
    }

    filtered.slice(0, 30).forEach(m => {
      resultsDropdown.appendChild(createDropdownItem(m));
    });

    resultsDropdown.style.display = filtered.length > 0 ? "block" : "none";
  });

  // Nascondi dropdown se clicchi fuori
  document.addEventListener("click", (e) => {
    if (!marketSearchWrap.contains(e.target)) {
      resultsDropdown.style.display = "none";
    }
  });
  // Mostra tutti i mercati quando l'input è vuoto e riceve focus
  marketInput.addEventListener("focus", () => {
    setFilter(currentFilter);
  });

  // Crosshair → aggiorna i valori OHLC
    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time) return;
      const price = param.seriesData.get(candleSeries);
      if (!price) return;

      let color = "#000";
      if (price.close > price.open) color = "#2e7d32"; // verde
      else if (price.close < price.open) color = "#c62828"; // rosso

      toolOHLC.style.color = color;
      toolOHLC.textContent = `O: ${price.open} | H: ${price.high} | L: ${price.low} | C: ${price.close}`;
    });

    // Catalogo indicatori
    const indicatorsCatalog = [
      { name: "SMA", key: "sma", position: "top" },
      { name: "EMA", key: "ema", position: "top" },
      { name: "Bollinger Bands", key: "bb", position: "top" },
      { name: "Parabolic SAR", key: "psar", position: "top" },
      { name: "Ichimoku Cloud", key: "ichimoku", position: "top" },
      { name: "RSI", key: "rsi", position: "bottom" },
      { name: "MACD", key: "macd", position: "bottom" },
      { name: "Volume", key: "vol", position: "bottom" },
      { name: "Stochastic", key: "stoch", position: "bottom" },
      { name: "ATR", key: "atr", position: "bottom" },
      { name: "CCI", key: "cci", position: "bottom" },
    ];
    indicatorsCatalog.forEach(ind => {
      const optI = document.createElement("option");
      optI.value = ind.key;
      optI.textContent = ind.name;
      indicatorSelect.appendChild(optI);
    });

    // ------------------- OVERLAY -------------------
    const addOverlayIndicator = (indKey, indName) => {
      if (overlaySeriesByKey.has(indKey)) return;
      let series = null;

      switch (indKey) {
        case "sma": {
          series = chart.addLineSeries({ color: "#1e88e5", lineWidth: 2 });
          series.setData(calcSMA(candleData, 14));
          break;
        }
        case "ema": {
          series = chart.addLineSeries({ color: "#43a047", lineWidth: 2 });
          series.setData(calcEMA(candleData, 14));
          break;
        }
        case "bb": {
          const bands = calcBollingerBands(candleData, 20, 2);
          const upperLine = chart.addLineSeries({ color: "#ff1744", lineWidth: 1, priceLineVisible: false });
          const middleLine = chart.addLineSeries({ color: "#1e88e5", lineWidth: 1, lineStyle: 2, priceLineVisible: false });
          const lowerLine = chart.addLineSeries({ color: "#26a69a", lineWidth: 1, priceLineVisible: false });
          upperLine.setData(bands.map(b => ({ time: b.time, value: b.upper })));
          middleLine.setData(bands.map(b => ({ time: b.time, value: b.middle })));
          lowerLine.setData(bands.map(b => ({ time: b.time, value: b.lower })));
          const bandFill = chart.addAreaSeries({ topColor: "rgba(0,0,0,0)", bottomColor: "rgba(30,136,229,0.16)", lineColor: "transparent", lineWidth: 0, priceLineVisible: false });
          bandFill.setData(bands.map(b => ({ time: b.time, value: b.upper })));
          const bandMask = chart.addAreaSeries({ topColor: "#ffffff", bottomColor: "#ffffff", lineColor: "transparent", lineWidth: 0, priceLineVisible: false });
          bandMask.setData(bands.map(b => ({ time: b.time, value: b.lower })));
          series = { upperLine, middleLine, lowerLine, bandFill, bandMask };
          break;
        }
        case "psar": {
          const psarPoints = calcParabolicSAR(candleData, 0.02, 0.2);
          const psarSeries = chart.addScatterSeries
            ? chart.addScatterSeries({ color: "#e53935", symbol: "circle", size: 2 })
            : chart.addLineSeries({ color: "#e53935", lineWidth: 0, priceLineVisible: false });
          psarSeries.setData(psarPoints);
          series = { psarSeries };
          break;
        }
        case "ichimoku": {
          const { conversion, base, spanA, spanB, lagging } = calcIchimokuCloud(candleData);
          const convS = chart.addLineSeries({ color: "#1e88e5", lineWidth: 1 }); convS.setData(conversion);
          const baseS = chart.addLineSeries({ color: "#e53935", lineWidth: 1 }); baseS.setData(base);
          const spanAS = chart.addLineSeries({ color: "#43a047", lineWidth: 1 }); spanAS.setData(spanA);
          const spanBS = chart.addLineSeries({ color: "#fb8c00", lineWidth: 1 }); spanBS.setData(spanB);
          const lagS = chart.addLineSeries({ color: "#8e24aa", lineWidth: 1 }); lagS.setData(lagging);
          series = { convS, baseS, spanAS, spanBS, lagS };
          break;
        }
        default:
          console.warn("Indicatore overlay non riconosciuto:", indKey);
          return;
      }

      overlaySeriesByKey.set(indKey, series);

      // Creazione chip
      const chip = document.createElement("div");
      chip.style = `background: rgba(255,255,255,0.92); margin-top:30px; border:1px solid #ddd; border-radius:20px; padding:4px 8px; display:flex; align-items:center; gap:8px; pointer-events:auto; box-shadow: 0 1px 2px rgba(0,0,0,0.05);`;
      const label = document.createElement("strong");
      label.style = `font-size:12px; color:black;`;
      label.textContent = indName;
      const btnCfg = document.createElement("button");
      btnCfg.type = "button";
      btnCfg.title = "Impostazioni";
      btnCfg.onclick = () => openSettings(indKey, indName);
      btnCfg.style = `border:none; background:none; cursor:pointer; font-size:13px;`;
      btnCfg.innerHTML = `<i class="fa-solid fa-gears"></i>`;
      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.title = "Rimuovi";
      btnDel.style = `border:none; background:none; cursor:pointer; font-size:13px; color:#c62828;`;
      btnDel.innerHTML = `<i class="fa-solid fa-trash"></i>`;
      btnDel.onclick = () => {
        removeSeriesFromChart(chart, series);
        overlaySeriesByKey.delete(indKey);
        try { chip.remove(); } catch (e) { console.error(e); }
      };
      chip.appendChild(label);
      chip.appendChild(btnCfg);
      chip.appendChild(btnDel);
      indicatorsOverlay.appendChild(chip);
    };

    // ------------------- BOTTOM -------------------
    const addBottomIndicator = (indKey, indName) => {
      if (subBlocks.has(indKey)) return;
      const wrap = document.createElement("div");
      wrap.style = `background:#fff; border:1px solid #eee; border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:8px; min-height:160px; color:black;`;
      const header = document.createElement("div");
      header.style = `display:flex; align-items:center; justify-content:space-between;`;
      const title = document.createElement("strong");
      title.textContent = indName;
      title.style = `font-size:13px;`;
      const btns = document.createElement("div");
      btns.style = `display:flex; gap:8px;`;
      const btnCfg = document.createElement("button");
      btnCfg.type = "button";
      btnCfg.title = "Impostazioni";
      btnCfg.style = `border:none; background:none; cursor:pointer; font-size:14px;`;
      btnCfg.innerHTML = `<i class="fa-solid fa-gears"></i>`;
      btnCfg.onclick = () => openSettings(indKey, indName);
      const btnDel = document.createElement("button");
      btnDel.type = "button";
      btnDel.title = "Rimuovi";
      btnDel.style = `border:none; background:none; cursor:pointer; font-size:14px; color:#c62828;`;
      btnDel.innerHTML = `<i class="fa-solid fa-trash"></i>`;
      btns.appendChild(btnCfg);
      btns.appendChild(btnDel);
      header.appendChild(title);
      header.appendChild(btns);
      const miniDiv = document.createElement("div");
      miniDiv.style = `width:100%; height:120px;`;
      wrap.appendChild(header);
      wrap.appendChild(miniDiv);
      subIndicatorsSection.appendChild(wrap);
      const miniChart = LightweightCharts.createChart(miniDiv, {
        width: miniDiv.clientWidth,
        height: miniDiv.clientHeight,
        layout: { background: { color: "#ffffff" }, textColor: "#333" },
        grid: { vertLines: { color: "#f2f2f2" }, horzLines: { color: "#f2f2f2" } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: true },
      });
      const payload = { wrap, chart: miniChart, series: {} };

      const cleanData = (arr) => Array.isArray(arr) ? arr.filter(p => p && p.value !== undefined && p.value !== null) : [];

      switch (indKey) {
        case "rsi": {
          const rsiSeries = miniChart.addLineSeries({ color: "#8e24aa", lineWidth: 2 });
          rsiSeries.setData(cleanData(calcRSI(candleData, 14)));
          payload.series.rsiSeries = rsiSeries;
          break;
        }
        case "macd": {
          const { macdLine, signalLine, histogram } = calcMACD(candleData, 12, 26, 9);
          const macdS = miniChart.addLineSeries({ color: "#1e88e5", lineWidth: 2 });
          const signalS = miniChart.addLineSeries({ color: "#fb8c00", lineWidth: 1 });
          const histS = miniChart.addHistogramSeries({ base: 0 });
          macdS.setData(cleanData(macdLine));
          signalS.setData(cleanData(signalLine));
          histS.setData(cleanData(histogram));
          payload.series = { macdS, signalS, histS };
          break;
        }
        case "stoch": {
          const { k, d } = calcStochastic(candleData, 14, 3);
          const kSeries = miniChart.addLineSeries({ color: "#1976d2", lineWidth: 1 });
          const dSeries = miniChart.addLineSeries({ color: "#d32f2f", lineWidth: 1 });
          kSeries.setData(cleanData(k));
          dSeries.setData(cleanData(d));
          payload.series = { kSeries, dSeries };
          break;
        }
        case "atr": {
          const atrSeries = miniChart.addLineSeries({ color: "#43a047", lineWidth: 2 });
          atrSeries.setData(cleanData(calcATR(candleData, 14)));
          payload.series.atrSeries = atrSeries;
          break;
        }
        case "cci": {
          const cciSeries = miniChart.addLineSeries({ color: "#ffa000", lineWidth: 2 });
          cciSeries.setData(cleanData(calcCCI(candleData, 20)));
          payload.series.cciSeries = cciSeries;
          break;
        }
        case "vol": {
          const volS = miniChart.addHistogramSeries({ color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '' });
          volS.setData(candleData.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? '#26a69a' : '#ef5350'
          })));
          payload.series.volS = volS;
          break;
        }
      }

      btnDel.onclick = () => {
        Object.values(payload.series).forEach(s => miniChart.removeSeries(s));
        wrap.remove();
        subBlocks.delete(indKey);
      };

      new ResizeObserver(() => {
        miniChart.applyOptions({
          width: miniDiv.clientWidth,
          height: miniDiv.clientHeight
        });
      }).observe(miniDiv);
      subBlocks.set(indKey, payload);
    };

    // Eventi indicator select
    indicatorSelect.addEventListener("change", () => {
      const def = indicatorsCatalog.find(i => i.key === indicatorSelect.value);
      if (!def) return;
      if (def.position === "top") addOverlayIndicator(def.key, def.name);
      else addBottomIndicator(def.key, def.name);
      indicatorSelect.value = "";
    });

    const doResize = () => resizeMain(chart, chartArea);
    new ResizeObserver(doResize).observe(chartArea);
    new ResizeObserver(doResize).observe(container);
    window.addEventListener("resize", doResize);
    setTimeout(doResize, 0);
   
// ==============================
// 🎨 Disegni 
// ==============================

// Variabili globali condivise
let drawings = [];
let currentTool = null;
let isDrawing = false;
let drawCanvas = null;
let shapePopup = null;

drawCanvas = document.createElement("canvas");
  drawCanvas.style = `
  position: absolute;
  left: 0; top: 0;
  width: 100%; height: 100%;
  pointer-events: auto;
  z-index: 2500;
  `;

function updateCursor() {
  drawCanvas.style.cursor = currentTool === "pointer" || !currentTool ? "default" : "crosshair";
}
updateCursor();

chartArea.appendChild(drawCanvas);
new ResizeObserver(() => {
  drawCanvas.width = chartArea.clientWidth;
  drawCanvas.height = chartArea.clientHeight;
  redrawAll();
}).observe(chartArea);
    
const colorPicker = document.createElement("input");
colorPicker.type = "color";
colorPicker.value = lineColor;
colorPicker.title = "Colore disegno";
colorPicker.style = "border:none; background:transparent; padding:4px;";
colorPicker.oninput = () => lineColor = colorPicker.value;

const widthSelect = document.createElement("select");
[1,2,3,4,5].forEach(w => {
  const opt = document.createElement("option");
  opt.value = w; opt.textContent = `${w}px`;
  if (w === lineWidth) opt.selected = true;
  widthSelect.appendChild(opt);
});
widthSelect.onchange = () => lineWidth = parseInt(widthSelect.value);
widthSelect.style = "border:1px solid #ddd; border-radius:6px; padding:6px; background:#fff;";

// Creazione forma
function createShape(tool, x1, y1, x2, y2) {
  return {
    id: crypto.randomUUID(),
    tool,
    x1, y1, x2, y2,
    color: colorPicker?.value || "#ff0000",
    width: widthSelect ? parseInt(widthSelect.value) : 2,
    text: "",
    selected: false
  };
}

// Disegno singola forma
function drawTempShape(x1, y1, x2, y2, tool, ctx, color = "#ff0000", width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();

  switch (tool) {
    case "line":
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    case "rect":
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      break;
    case "circle":
      const r = Math.hypot(x2 - x1, y2 - y1);
      ctx.beginPath();
      ctx.arc(x1, y1, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "arrow":
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = 10;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
      break;
      case "pointer":
      // Non disegnare nulla per il puntatore
      break;
  }
}

// Disegna tutte le forme
function redrawAll() {
  const ctx = drawCanvas.getContext("2d");
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

  drawings.forEach(s => {
    drawTempShape(s.x1, s.y1, s.x2, s.y2, s.tool, ctx, s.color, s.width);

    // Testo
    if (s.text) {
      ctx.fillStyle = s.color;
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      if (s.tool === "line" || s.tool === "arrow") {
        ctx.fillText(s.text, (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2 - 5);
      } else {
        ctx.fillText(s.text, (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2);
      }
    }

    // Evidenzia selezionato
    if (s.selected) {
      ctx.strokeStyle = "blue";
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(
        Math.min(s.x1, s.x2) - 5,
        Math.min(s.y1, s.y2) - 5,
        Math.abs(s.x2 - s.x1) + 10,
        Math.abs(s.y2 - s.y1) + 10
      );
      ctx.setLineDash([]);
    }
  });
}

// Rileva forma cliccata
function getShapeAt(x, y) {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const s = drawings[i];
    if (s.tool === "rect") {
      if (x >= Math.min(s.x1, s.x2) && x <= Math.max(s.x1, s.x2) &&
          y >= Math.min(s.y1, s.y2) && y <= Math.max(s.y1, s.y2)) return s;
    }
    if (s.tool === "circle") {
      const r = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      if (Math.hypot(x - s.x1, y - s.y1) <= r) return s;
    }
    if (s.tool === "line" || s.tool === "arrow") {
      const A = {x: s.x1, y: s.y1}, B = {x: s.x2, y: s.y2};
      const AB = {x: B.x - A.x, y: B.y - A.y};
      const AP = {x: x - A.x, y: y - A.y};
      const t = Math.max(0, Math.min(1, (AP.x*AB.x + AP.y*AB.y) / (AB.x*AB.x + AB.y*AB.y)));
      const proj = {x: A.x + t*AB.x, y: A.y + t*AB.y};
      if (Math.hypot(proj.x - x, proj.y - y) <= 5) return s;
    }
  }
  return null;
}

function closeShapePopup() {
  if (shapePopup) {
    shapePopup.remove();
    shapePopup = null;
  }
}

// Popup proprietà forma
function openShapePopup(shape, clientX, clientY) {
  closeShapePopup();

  shapePopup = document.createElement("div");
  shapePopup.style = `
    position:fixed;
    left:${clientX + 10}px;
    top:${clientY + 10}px;
    background:#fff;
    border:1px solid #ccc;
    border-radius:6px;
    padding:8px;
    display:flex;
    flex-direction:column;
    gap:6px;
    z-index:5000;
    font-size:13px;
  `;

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = shape.color;
  colorInput.oninput = () => { shape.color = colorInput.value; redrawAll(); };

  const widthInput = document.createElement("input");
  widthInput.type = "range";
  widthInput.min = 1;
  widthInput.max = 10;
  widthInput.value = shape.width;
  widthInput.oninput = () => { shape.width = +widthInput.value; redrawAll(); };

  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.placeholder = "Testo...";
  textInput.value = shape.text;
  textInput.oninput = () => { shape.text = textInput.value; redrawAll(); };

  const delBtn = document.createElement("button");
  delBtn.textContent = "Elimina";
  delBtn.style = "background:#e53935; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;";
  delBtn.onclick = () => {
    drawings = drawings.filter(s => s.id !== shape.id);
    closeShapePopup();
    redrawAll();
  };

  shapePopup.append(colorInput, widthInput, textInput, delBtn);
  document.body.appendChild(shapePopup);
}



// Eventi del canvas
drawCanvas.addEventListener("mousedown", (e) => {
  if (!currentTool || currentTool === "pointer") return;
  isDrawing = true;
  const rect = drawCanvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  endX = startX; endY = startY;
});

drawCanvas.addEventListener("mousemove", (e) => {
  if (!isDrawing || !currentTool || currentTool === "pointer") return;
  const rect = drawCanvas.getBoundingClientRect();
  endX = e.clientX - rect.left;
  endY = e.clientY - rect.top;
  const ctx = drawCanvas.getContext("2d");
  ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  redrawAll();
  drawTempShape(startX, startY, endX, endY, currentTool, ctx, colorPicker.value, parseInt(widthSelect.value));
});

drawCanvas.addEventListener("mouseup", (e) => {
  if (!isDrawing || !currentTool || currentTool === "pointer") return;
  isDrawing = false;
  const rect = drawCanvas.getBoundingClientRect();
  endX = e.clientX - rect.left;
  endY = e.clientY - rect.top;
  const newShape = createShape(currentTool, startX, startY, endX, endY);
  drawings.push(newShape);
  redrawAll();
});

drawCanvas.addEventListener("click", (e) => {
  const rect = drawCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const target = getShapeAt(x, y);

  drawings.forEach(s => s.selected = false);
  if (target) {
    target.selected = true;
    openShapePopup(target, e.clientX, e.clientY);
  } else {
    closeShapePopup();
  }
  redrawAll();
});

//-----------------------------
// Aggiunta Testo
//-----------------------------
let textCanvas = null;

textCanvas = document.createElement("div");
textCanvas.style = `
  position: absolute;
  left: 0; top: 0;
  width: 100%; height: 100%;
  pointer-events: auto;
  z-index: 2600;
`;
chartArea.appendChild(textCanvas);

const btnNote = toolsLeft.querySelector('button[title="Note testuali"]');
if (btnNote) {
  btnNote.addEventListener("click", () => {
    enableTextPlacementMode();
  });
}

function enableTextPlacementMode() {
  if (!textCanvas) return;


  // Listener temporaneo
  const handleClick = (e) => {
    const rect = chartArea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    createTextNote(x, y);
    textCanvas.removeEventListener("click", handleClick);
  };

  textCanvas.addEventListener("click", handleClick);
}


function createTextNote(x, y) {
  const note = document.createElement("div");
  note.className = "chart-note";
  note.contentEditable = "true";
  note.textContent = "Scrivi qui...";
  note.style = `
    position:absolute;
    left:${x}px;
    top:${y}px;
    background:rgba(255,255,255,0.95);
    color:#000;
    border:1px solid #ccc;
    border-radius:6px;
    padding:6px 8px;
    font-size:14px;
    cursor:move;
    min-width:80px;
    max-width:220px;
    z-index:5000;
  `;
  textCanvas.appendChild(note);

  note.addEventListener("click", (e) => {
  e.stopPropagation();
  openNotePopup(note, e.clientX, e.clientY);
});

let isDragging = false, offsetX = 0, offsetY = 0;
note.addEventListener("mousedown", (e) => {
  if (e.target !== note) return;
  isDragging = true;
  offsetX = e.offsetX;
  offsetY = e.offsetY;
});
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  note.style.left = `${e.clientX - chartArea.getBoundingClientRect().left - offsetX}px`;
  note.style.top = `${e.clientY - chartArea.getBoundingClientRect().top - offsetY}px`;
});
window.addEventListener("mouseup", () => isDragging = false);

}

function openNotePopup(note, clientX, clientY) {
  // Chiudi eventuali popup già aperti
  const oldPopup = document.getElementById("notePopup");
  if (oldPopup) oldPopup.remove();

  // Crea il contenitore del popup
  const popup = document.createElement("div");
  popup.id = "notePopup";
  popup.style = `
    position: fixed;
    left: ${clientX + 10}px;
    top: ${clientY + 10}px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.15);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 160px;
  `;

  // Campo per modificare testo
  const textInput = document.createElement("textarea");
  textInput.value = note.textContent.trim();
  textInput.style = "resize:none; width:100%; height:40px;";
  textInput.oninput = () => { note.textContent = textInput.value; };

  // Colore testo
  const colorLabel = document.createElement("label");
  colorLabel.textContent = "Colore testo:";
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = rgbToHex(note.style.color || "#000000");
  colorInput.oninput = () => { note.style.color = colorInput.value; };

  // Dimensione testo
  const sizeLabel = document.createElement("label");
  sizeLabel.textContent = "Dimensione:";
  const sizeInput = document.createElement("input");
  sizeInput.type = "range";
  sizeInput.min = 10;
  sizeInput.max = 40;
  sizeInput.value = parseInt(note.style.fontSize) || 14;
  sizeInput.oninput = () => { note.style.fontSize = `${sizeInput.value}px`; };

  // Pulsante elimina
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "🗑️ Elimina nota";
  deleteBtn.style = `
    background:#ff4d4d;
    color:#fff;
    border:none;
    border-radius:4px;
    padding:4px 6px;
    cursor:pointer;
  `;
  deleteBtn.onclick = () => {
      note.remove();
      popup.remove();
  };

  // Aggiungi elementi al popup
  popup.append(
    textInput,
    colorLabel, colorInput,
    sizeLabel, sizeInput,
    deleteBtn
  );
  document.body.appendChild(popup);

  // Chiusura automatica cliccando fuori
  setTimeout(() => {
    const closeHandler = (ev) => {
      if (!popup.contains(ev.target) && ev.target !== note) {
        popup.remove();
        document.removeEventListener("click", closeHandler);
      }
    };
    document.addEventListener("click", closeHandler);
  }, 100);
}

function rgbToHex(rgb) {
  const result = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(rgb);
  return result
    ? "#" +
        result
          .slice(1)
          .map((x) => ("0" + parseInt(x).toString(16)).slice(-2))
          .join("")
    : rgb;
}

}




