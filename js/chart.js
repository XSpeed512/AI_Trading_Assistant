// ==========================================
// VARIABILI GLOBALI
// ==========================================
let candleData = [];  // Dati delle candele (OHLC)
let allMarketsList = [];  // Lista di tutti i mercati disponibili
const API_KEY = "2d861128d51349ec952f709b9d504476";
let currentTimeframe = "1h"; // Timeframe corrente
let currentSymbol = "AAPL"; // Simbolo del mercato corrente
let lineColor = "#ff0000";  // Colore delle linee di disegno
let lineWidth = 2;  // Spessore delle linee di disegno

let PriceScale = null;
let TimeScale = null;
const overlaySeriesByKey = new Map();  // Mappa degli indicatori sovrapposti
const subBlocks = new Map();  // Mappa dei blocchi inferiori per indicatori
const logoCache = new Map();  // Cache dei logo dei simboli

let visibleStart = 0;
let visibleCount = 120;
let priceCenter = null
let priceScaleFactor = 1.0; // 1.0 = default, <1 ingrandisce, >1 rimpicciolisce
const MIN_PRICE_SCALE = 0.4;
const MAX_PRICE_SCALE = 2.5;
const PRICE_SCALE_WIDTH = 70
const TIME_SCALE_HEIGHT = 25;
let priceToY;
let yToPrice;


// Scarica i dati delle candele da TwelveData API per un simbolo e un intervallo specificati
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

// Ricarica i dati delle candele e ridisegna il grafico
async function reloadCandles() {
  if (!currentSymbol) return;
  const data = await fetchCandles(currentSymbol, currentTimeframe);
  candleData = Array.isArray(data) ? data : [];
  // redraw using canvas
  drawCandles();
  //refreshIndicators();
}



function drawPriceScale(min, max, chartHeight) {

  if (!PriceScale || typeof yToPrice !== 'function') return

  const steps = 6

  PriceScale.innerHTML = ""

  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps
    const y = fraction * chartHeight
    const price = yToPrice(y)

    const tick = document.createElement("div")
    tick.style.position = "absolute"
    tick.style.right = "2px"
    tick.style.top = `${y}px`
    tick.style.transform = "translateY(-50%)"
    tick.style.color = "#555";
    tick.style.whiteSpace = "nowrap"
    tick.style.userSelect = "none"
    tick.textContent = price.toFixed(2)

    PriceScale.appendChild(tick)
  }

  const title = document.createElement("div")
  title.style.position = "absolute"
  title.style.left = "50%"
  title.style.bottom = "2px"
  title.style.transform = "translateX(-50%)"
  title.style.fontSize = "10px"
  title.style.color = "#555"
  title.textContent = "Price scale"
  PriceScale.appendChild(title)

}

function drawTimeScale(visibleData, chartWidth) {

  if (!TimeScale) return

  const steps = 8
  const step = visibleData.length / steps

  TimeScale.innerHTML = ""

  for (let i = 0; i <= steps; i++) {
    const index = Math.min(visibleData.length - 1, Math.floor(i * step))
    const dataPoint = visibleData[index]
    if (!dataPoint) continue

    const t = new Date(dataPoint.time * 1000)
    const labelText = `${t.getHours().toString().padStart(2, "0")}:${t.getMinutes().toString().padStart(2, "0")}`

    const tick = document.createElement("span")
    tick.style.position = "absolute"
    tick.style.left = `${(i / steps) * 100}%`
    tick.style.transform = "translateX(-50%)"
    tick.style.fontSize = "11px"
    tick.style.color = "#555"
    tick.style.userSelect = "none"
    tick.style.whiteSpace = "nowrap"
    tick.textContent = labelText

    TimeScale.appendChild(tick)
  }

  const title = document.createElement("div")
  title.style.position = "absolute"
  title.style.right = "8px"
  title.style.bottom = "2px"
  title.style.fontSize = "10px"
  title.style.color = "#555"
  title.textContent = "Time scale"
  TimeScale.appendChild(title)

}

// ==========================================
// INIZIALIZZAZIONE GRAFICO E INTERFACCIA
// ==========================================
// Inizializza il grafico e tutti gli elementi dell'interfaccia utente
function initChart(container) {

  container.innerHTML = "";
  container.style.position = "relative";
  container.style.display = "flex";
  container.style.flexDirection = "column";

  // ==========================================
  // CREAZIONE TOOLBAR PRINCIPALE
  // ==========================================
  // Barra superiore con strumenti e controlli
  const toolbar = document.createElement("div");
  toolbar.style = `
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding:8px 12px;
    border-bottom:1px solid #e0e0e0;
    background:#fafafa;
    flex:0;
  `;

  // =========================================
  // SEZIONE STRUMENTI A SINISTRA
  // =========================================
  // Contenitore per i pulsanti degli strumenti di disegno
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

  // =========================================
  // MENU SOTTOSTANTI DISEGNI
  // =========================================
  // Menu a tendina con opzioni di disegno (linea, rettangolo, cerchio, freccia, puntatore)
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

  // =========================================
  // BARRA DI RICERCA MERCATI
  // =========================================
  // Elemento di ricerca con autocomplete per selezionare simboli da tradare
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


  // =========================================
  // HEADER CON BOTTONI FILTRO MERCATI
  // =========================================
  // Barra di filtro per categorie (Tutto, Forex, Stock, Crypto, ETF, Commodity)
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

  // Stile CSS per i bottoni filtro
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

  // Crea un bottone filtro con stile e evento click
  function createButton(label, filterType) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style = buttonStyle;
    btn.onmouseover = () => (btn.style.background = "#e0e0e0");
    btn.onmouseout = () => (btn.style.background = "#fff");
    btn.onclick = () => setFilter(filterType);
    return btn;
  }
  2
  // Creazione dei bottoni filtro
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


  // =========================================
  // CREAZIONE ELEMENTI DROPDOWN RISULTATI
  // =========================================
  // Crea un elemento della lista di risultati della ricerca mercati
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

  // =========================================
  // GESTIONE FILTRI CATEGORIA MERCATI
  // =========================================
  // Applica il filtro selezionato e aggiorna la lista di risultati
  let currentFilter = "all";
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

  // =========================================
  // EVENTO DI RICERCA E FILTRO MERCATI
  // =========================================
  // Gestisce l'input dell'utente nella barra di ricerca e aggiorna i risultati
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

  // =========================================
  // SELETTORE TIMEFRAME
  // =========================================
  // Dropdown per scegliere l'intervallo temporale delle candele
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

  // =========================================
  // SELETTORE INDICATORI
  // =========================================
  // Dropdown per aggiungere indicatori tecnici al grafico
  const indicatorSelect = document.createElement("select");
  indicatorSelect.style = `border:1px solid #ddd; background:#fff; border-radius:6px; padding:8px 14px; cursor:pointer; flex:0 0 auto; margin-left:8px;`;
  indicatorSelect.innerHTML = `<option value="" selected disabled>Aggiungi indicatore</option>`;

  toolbar.appendChild(toolsLeft);
  toolbar.appendChild(marketSearchWrap);
  toolbar.appendChild(timeframeWrap);
  toolbar.appendChild(indicatorSelect);

  // =========================================
  // CATALOGO INDICATORI DISPONIBILI
  // =========================================
  // Elenco di tutti gli indicatori che possono essere aggiunti al grafico
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

  // =========================================
  // AREA DEL GRAFICO
  // =========================================
  // Contenitore principale dove viene disegnato il grafico canvas
  const chartArea = document.createElement("div");
  chartArea.style = `
    position:relative;
    flex:1 1 auto; min-height:240px;
    background:#fff;
    border:1px solid #eee;
    border-radius:0 0 8px 8px;
  `;
  const priceScaleArea = document.createElement("div");
  priceScaleArea.style = `
  position:absolute;
  top:0;
  right:0;
  width:${PRICE_SCALE_WIDTH}px;
  height: calc(100% - ${TIME_SCALE_HEIGHT}px);
  border-left:1px solid #eee;
  background:#fafafa;
  display:flex;
  justify-content:space-between;
  flex-direction:column;
  padding:2px 4px;
  z-index:2;
`;
  chartArea.appendChild(priceScaleArea);
  PriceScale = priceScaleArea;

  const timeScaleArea = document.createElement("div");
  timeScaleArea.style = `
  position:absolute;
  left:0;
  bottom:0;
  width: calc(100% - ${PRICE_SCALE_WIDTH}px);
  height: ${TIME_SCALE_HEIGHT}px;
  border-top:1px solid #eee;
  background:#fafafa;
  box-sizing:border-box;
  display:block;
  padding:0;
  z-index:2;
  overflow:hidden;
`;
  chartArea.appendChild(timeScaleArea);
  TimeScale = timeScaleArea;

  const cornerScale = document.createElement("div");
  cornerScale.style = `
  position:absolute;
  width:calc(100% - ${PRICE_SCALE_WIDTH}px);
  height:${TIME_SCALE_HEIGHT}px;
  bottom:0;
  right:0;
  background:#fafafa;
`;
  chartArea.appendChild(cornerScale);


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
  subIndicatorsSection.style = `display:flex; flex-direction:column; gap:8px; flex:0;`;

  // =========================================
  // INTESTAZIONE GRAFICO CON LOGO E SIMBOLO
  // =========================================
  // Mostra il logo del simbolo e i dati OHLC correnti
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


  // =========================================
  // ELEMENTO CANVAS PER DISEGNO
  // =========================================
  // Canvas HTML5 per il rendering performante del grafico delle candele
  const chartCanvas = document.createElement('canvas');
  chartCanvas.style = `width:100%; height:100%; z-index:1; position:relative;`;
  chartCanvas.width = chartArea.clientWidth;
  chartCanvas.height = chartArea.clientHeight;
  chartArea.appendChild(chartCanvas);

  container.appendChild(toolbar);
  container.appendChild(chartArea);
  container.appendChild(subIndicatorsSection);
  container._chartArea = chartArea;


  // =========================================
  // MOTORE DI RENDERING CANVAS
  // ==========================================


  // Funzione principale per disegnare le candele sul canvas in base ai dati correnti
  function drawCandles() {

    if (!chartCanvas) return;

    const ctx = chartCanvas.getContext("2d");

    chartCanvas.width = chartArea.clientWidth
    chartCanvas.height = chartArea.clientHeight

    const width = chartCanvas.width
    const height = chartCanvas.height

    const chartWidth = width - PRICE_SCALE_WIDTH
    const chartHeight = height - TIME_SCALE_HEIGHT

    ctx.clearRect(0, 0, width, height)

    if (!candleData || candleData.length === 0) return

    const visibleData = candleData.slice(visibleStart, visibleStart + visibleCount)

    if (!visibleData.length) return

    const minPrice = Math.min(...visibleData.map(c => c.low))
    const maxPrice = Math.max(...visibleData.map(c => c.high))

    const priceRange = maxPrice - minPrice
    const scaledRange = Math.max(0.0001, priceRange * priceScaleFactor)

    if (priceCenter === null) {
      priceCenter = (maxPrice + minPrice) / 2
    }

    priceToY = p => {
      const norm = (p - priceCenter) / scaledRange
      return chartHeight / 2 - norm * chartHeight
    }

    yToPrice = y => {
      const norm = (chartHeight / 2 - y) / chartHeight
      return priceCenter + norm * scaledRange
    }

    const candleStep = chartWidth / visibleData.length

    visibleData.forEach((candle, index) => {

      const x = index * candleStep + candleStep / 2

      const high = priceToY(candle.high)
      const low = priceToY(candle.low)
      const open = priceToY(candle.open)
      const close = priceToY(candle.close)

      const color = candle.close >= candle.open ? "#2ecc71" : "#e74c3c"

      ctx.strokeStyle = color
      ctx.beginPath()
      ctx.moveTo(x, high)
      ctx.lineTo(x, low)
      ctx.stroke()

      const bodyWidth = Math.max(2, candleStep * 0.6)
      const bodyX = x - bodyWidth / 2
      const bodyY = Math.min(open, close)
      const bodyHeight = Math.max(1, Math.abs(close - open))

      ctx.fillStyle = color
      ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight)

    })

    const realMin = priceCenter - scaledRange
    const realMax = priceCenter + scaledRange

    drawPriceScale(realMin, realMax, chartHeight)
    drawTimeScale(visibleData, chartWidth)

  }

  window.drawCandles = drawCandles


  // ==========================================
  // CROSSHAIR ENGINE
  // ==========================================

  let crosshair = { x: null, y: null }

  chartCanvas.addEventListener("mousemove", e => {

    const rect = chartCanvas.getBoundingClientRect()

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    crosshair.x = x
    crosshair.y = y

    const visibleData = candleData.slice(visibleStart, visibleStart + visibleCount)

    const step = (chartCanvas.width - PRICE_SCALE_WIDTH) / visibleData.length

    const index = Math.floor(x / step)

    const candle = visibleData[index]
    const price = yToPrice(y);
    if (candle) {

      let color = "#000"

      toolOHLC.style.color = color
      toolOHLC.textContent =
        `O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} | P:${price.toFixed(2)}`

    }

    render()

  })


  function render() {

    drawCandles()

    if (crosshair.x === null) return

    const ctx = chartCanvas.getContext("2d")

    ctx.strokeStyle = "#999"
    ctx.lineWidth = 1

    ctx.beginPath()
    ctx.moveTo(crosshair.x, 0)
    ctx.lineTo(crosshair.x, chartCanvas.height)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, crosshair.y)
    ctx.lineTo(chartCanvas.width, crosshair.y)
    ctx.stroke()

  }


  // ==========================================
  // PAN ENGINE (DRAG ON CHART)
  // ==========================================

  let isChartDragging = false
  let chartDragStartX = 0
  let chartDragStartY = 0
  let chartDragStartVisible = 0

  chartCanvas.addEventListener("mousedown", e => {
    if (e.button !== 0) return
    isChartDragging = true
    chartDragStartX = e.clientX
    chartDragStartY = e.clientY
    chartDragStartVisible = visibleStart
    chartCanvas.style.cursor = "grabbing"
    e.preventDefault()
  })

  const stopChartDrag = () => {
    isChartDragging = false
    chartCanvas.style.cursor = "default"
  }

  chartCanvas.addEventListener("mouseup", stopChartDrag)
  chartCanvas.addEventListener("mouseleave", stopChartDrag)

  chartCanvas.addEventListener("mousemove", e => {
    if (!isChartDragging) return

    const dx = e.clientX - chartDragStartX
    const dy = e.clientY - chartDragStartY
    const panSensitivity = 8
    const pricePanSensitivity = 0.005

    visibleStart = chartDragStartVisible - Math.round(dx / panSensitivity)
    visibleStart = Math.max(0, visibleStart)
    visibleStart = Math.min(candleData.length - visibleCount, visibleStart)

    // Vertical drag pans a price center
    if (typeof priceCenter === 'number') {
      priceCenter = priceCenter + dy * pricePanSensitivity * priceScaleFactor
    }

    render()
  })


  // ==========================================
  // SCALE ZOOM ENGINE (DRAG ON PRICE/TIME SCALES)
  // ==========================================

  let isPriceDragging = false
  let priceDragStartY = 0
  let priceDragAnchorPrice = 0
  let priceDragInitialScale = 1

  priceScaleArea.addEventListener("mousedown", e => {
    if (e.button !== 0) return
    isPriceDragging = true
    priceDragStartY = e.clientY
    priceDragAnchorPrice = yToPrice(e.clientY - chartCanvas.getBoundingClientRect().top)
    priceDragInitialScale = priceScaleFactor
    priceScaleArea.style.cursor = "ns-resize"
    e.preventDefault()
  })

  const stopPriceDrag = () => {
    isPriceDragging = false
    priceScaleArea.style.cursor = "default"
  }

  priceScaleArea.addEventListener("mouseup", stopPriceDrag)
  priceScaleArea.addEventListener("mouseleave", stopPriceDrag)

  priceScaleArea.addEventListener("mousemove", e => {
    if (!isPriceDragging) return

    const dy = e.clientY - priceDragStartY
    const scaleFactorDelta = 1 - dy * 0.005
    let newScale = priceDragInitialScale * scaleFactorDelta
    newScale = Math.max(MIN_PRICE_SCALE, Math.min(MAX_PRICE_SCALE, newScale))

    const ratio = newScale / priceScaleFactor
    priceCenter = priceDragAnchorPrice + (priceCenter - priceDragAnchorPrice) * ratio
    priceScaleFactor = newScale

    render()
  })


  let isTimeDragging = false
  let timeDragStartX = 0
  let timeDragInitialCount = 0
  let timeDragAnchorIndex = 0

  timeScaleArea.addEventListener("mousedown", e => {
    if (e.button !== 0) return
    isTimeDragging = true
    timeDragStartX = e.clientX
    timeDragInitialCount = visibleCount
    timeDragAnchorIndex = visibleStart + Math.floor((e.clientX - chartCanvas.getBoundingClientRect().left) / ((chartCanvas.width - PRICE_SCALE_WIDTH) / visibleCount))
    timeScaleArea.style.cursor = "ew-resize"
    e.preventDefault()
  })

  const stopTimeDrag = () => {
    isTimeDragging = false
    timeScaleArea.style.cursor = "default"
  }

  timeScaleArea.addEventListener("mouseup", stopTimeDrag)
  timeScaleArea.addEventListener("mouseleave", stopTimeDrag)

  timeScaleArea.addEventListener("mousemove", e => {
    if (!isTimeDragging) return

    const dx = e.clientX - timeDragStartX
    const scaleFactorDelta = 1 - dx * 0.003
    let newCount = Math.round(timeDragInitialCount * scaleFactorDelta)
    newCount = Math.max(30, Math.min(candleData.length, newCount))

    const relativeAnchor = (timeDragAnchorIndex - visibleStart) / visibleCount
    visibleStart = Math.round(timeDragAnchorIndex - relativeAnchor * newCount)
    visibleStart = Math.max(0, Math.min(candleData.length - newCount, visibleStart))
    visibleCount = newCount

    render()
  })



  reloadCandles();

  window.addEventListener('resize', () => {
    if (typeof drawCandles === 'function') {
      drawCandles();
    }
  });
}




