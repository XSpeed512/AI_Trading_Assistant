<?php
session_start();
include("includes/header.php");
$isGuest = !isset($_SESSION['user_id']) && !isset($_SESSION['guest']);
if ($isGuest) {
    // Modalità ospite limitata: mostra subito la dashboard per 60s, poi il gate login
    $deadline = time() + 60;
}
?>
<!DOCTYPE html>
<html lang="it">
<head>

  	<!-- CSS -->
  	<link rel="stylesheet" href="css/index.css">
  	<!-- GridStack CSS -->
  	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gridstack@10.0.1/dist/gridstack.min.css" />

</head>
<body>

  <header>
      <div class="container">
          <h1> AI Trading Assistant</h1>
      </div>
      <div class="icon">
          <?php if(isset($_SESSION["username"])): ?>
            <a href="auth/logout.php" title="Logout"><i class="fa-solid fa-right-from-bracket"></i></a>
          <?php else: ?>
            <a href="auth/login.php" title="Accedi"><i class="fa-solid fa-user"></i></a>
          <?php endif; ?>
          <a href="#" title="Impostazioni"><i class="fa-solid fa-gear"></i></a>
          <?php if(isset($_SESSION["username"]) && $_SESSION['role'] === "admin"): ?>
            <a href="auth/admin.php" title="Admin"><i class="fa-solid fa-screwdriver-wrench"></i></a>
          <?php endif; ?>
      </div>
  </header>

  <!-- Gate login (mostrato solo se ospite DOPO il timer) -->
  <main id="page-wrap" class="page-wrap" style="display:none;">
    <form class="card">
      <h2 class="title">Accedi o registrati</h2>
      <p class="subtitle">Per continuare a lavorare accedi al tuo profilo o crea un account.</p>
      <a href="auth/login.php" class="btn" style="width:100%; display:flex; justify-content:center;">Accedi</a>
      <a href="auth/register.php" class="btn" style="margin-top:20px; width:100%; display:flex; justify-content:center;">Crea un account</a>
    </form>
  </main>

 <?php if (false/*$isGuest*/): ?>
  <script>
    // Timer ospite: dopo N ms nascondo dashboard e mostro gate login
    const delay = <?= max(0, ($deadline - time())*1000) ?>;
    setTimeout(function() {
      const c = document.getElementById('container');
      const p = document.getElementById('page-wrap');
      if (c) c.style.display = 'none';
      if (p) p.style.display = 'flex';
    }, delay);
  </script>
  <?php endif; ?>

 	 <!-- Libs -->
  	<script src="https://cdnjs.cloudflare.com/ajax/libs/gridstack.js/10.0.1/gridstack-all.min.js"></script>
	
	<!-- Script Chart-->
   	<script src="https://unpkg.com/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js"></script>
    <script defer src="../js/chart.js" ></script>

 <!-- Dashboard -->
<div id="container" class="container grid-stack"></div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  // ----- GridStack init -----
  const grid = GridStack.init({
    cellHeight: 160,
    float: false,
    column: 12,
    disableOneColumnMode: false,
    handle: '.widget-header',
    resizable: { handles: 'e,w,s,n,se,sw,ne,nw' },
    draggable: { dragStartDelay: 600, touch: true }
  });

  // ----- Breakpoint responsive -----
  function updateGridColumns() {
    if (window.innerWidth < 768) {
      grid.column(1);
    } else if (window.innerWidth < 1200) {
      grid.column(6);
    } else {
      grid.column(12);
    }
    
  }
  updateGridColumns();
  window.addEventListener('resize', updateGridColumns);

  const IS_LOGGED = <?= isset($_SESSION['user_id']) ? 'true' : 'false'; ?>;

  // ----- HTML factory dei widget -----
  function widgetHtml(key) {
    switch (key) {
      case 'grafico':
        return `
          <div class="grid-stack-item-content" data-key="grafico">
            <div class="widget-header">
              <div class="widget-title"><i class="fa-solid fa-chart-line"></i> Chart</div>
            </div>
            <div class="widget-chart"><div id="marketChart" style="width: 100%; height: 100%; min-height: 300px;"></div></div>
          </div>`;
      case 'chat_ai':
        return `
          <div class="grid-stack-item-content" data-key="chat_ai">
            <div class="widget-header">
              <div class="widget-title"><i class="fa-solid fa-robot"></i> Chat AI</div>
            </div>
            <div class="widget-chat-messages" id="chatMessages">
              <p><em>AI:</em> Ciao! Posso aiutarti con analisi e strategie.</p>
            </div>
            <div class="widget-chat-input">
              <input type="text" id="chatInput" placeholder="Scrivi un messaggio...">
              <button class="btn" id="chatSend">Invia</button>
            </div>
          </div>`;
      case 'broker':
        return `
          <div class="grid-stack-item-content widget-broker" data-key="broker">
            <div class="widget-header">
              <div class="widget-title"><i class="fa-solid fa-building-columns"></i> Account Broker</div>
            </div>
            <a href="#">Collega nuovo broker</a>
            <a href="#">Visualizza ordini aperti</a>
          </div>`;
      case 'strategie':
        return `
          <div class="grid-stack-item-content widget-strategies" data-key="strategie">
            <div class="widget-header">
              <div class="widget-title"><i class="fa-solid fa-list-check"></i> Consigli Magici</div>
            </div>
            <ul>
              <li>
              <strong>XAUUSD </strong> (H4) <br>
              Type: BUY <br>
              TP: 4184 <br>
              SL: 4088 <br>
              Lottaggio consigliato: 0.02 <br>
              </li>
			  <li>
              <strong>EURUSD </strong> (H1)<br>
              Type: BUY <br>
              TP: 1.1631 <br>
              SL: 1.1539 <br>
              Lottaggio consigliato: 0.02<br>
              </li>
            </ul>
          </div>`;
      case 'portfolio':
        return `
          <div class="grid-stack-item-content" data-key="portfolio">
            <div class="widget-header">
              <div class="widget-title"><i class="fa-solid fa-briefcase"></i> Portfolio</div>
            </div>
            <div class="widget-body">
              <p>Valore totale: <strong>€ 10.500</strong></p>
              <p>P/L giornaliero: <strong>+€ 120</strong></p>
            </div>
          </div>`;
    }
    return '';
  }

  // ----- Default layout (mostrato SUBITO) -----
  function addDefaultWidgets() {
    grid.addWidget(`
      <div class="grid-stack-item" gs-w="8" gs-h="4" gs-x="0" gs-y="0">
        ${widgetHtml('grafico')}
      </div>`);
    /*
    const chartId = document.querySelector('#marketChart');
  	if (chartId) initChart(chartId);
    */
    grid.addWidget(`
      <div class="grid-stack-item" gs-w="4" gs-h="4" gs-x="8" gs-y="0">
        ${widgetHtml('chat_ai')}
      </div>`);

    grid.addWidget(`
      <div class="grid-stack-item" gs-w="4" gs-h="3" gs-x="0" gs-y="4">
        ${widgetHtml('broker')}
      </div>`);

    grid.addWidget(`
      <div class="grid-stack-item" gs-w="4" gs-h="3" gs-x="4" gs-y="4">
        ${widgetHtml('strategie')}
      </div>`);

    grid.addWidget(`
      <div class="grid-stack-item" gs-w="4" gs-h="3" gs-x="8" gs-y="4">
        ${widgetHtml('portfolio')}
      </div>`);
  }

  // ----- Ottieni layout corrente -----
  function getCurrentLayout() {
    const layout = [];
    grid.engine.nodes.forEach(node => {
      const el = node.el.querySelector('.grid-stack-item-content');
      if (!el) return;
      layout.push({
        id: el.dataset.key,
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h
      });
    });
    return layout;
  }

  if(IS_LOGGED){
    // ----- Salvataggio layout -----
    function saveLayout() {
      const payload = getCurrentLayout();
      fetch('config/layout.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      })
      .then(r => {
        if (!r.ok) throw new Error('HTTP '+r.status);
        return r.json();
      })
      .then(json => {
        console.log('Layout salvato:', json);
      })
      .catch(err => {
        console.debug('Salvataggio non eseguito (ospite o errore):', err.message);
      });
    }

    function debounce(fn, wait) { 
      let t; 
      return (...args) => { 
        clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); 
      }; 
    } 
    const saveLayoutDebounced = debounce(saveLayout, 600);

    // ----- Caricamento layout -----
    function loadSavedLayoutOrKeepDefault() {
      fetch('config/layout.php', { credentials: 'same-origin' })
        .then(r => r.text())
        .then(txt => {
          let widgets;
          try {
            widgets = JSON.parse(txt);
          } catch(e) {
            console.error('Errore parsing JSON:', e.message);
            widgets = [];
          }
        
          if (Array.isArray(widgets) && widgets.length > 0) {
            grid.batchUpdate(true);
            grid.removeAll();
            widgets.forEach(w => {
              const html = widgetHtml(w.widget_key || w.id);
              if (!html) return;
              grid.addWidget(`
                <div class="grid-stack-item" gs-w="${w.width || w.w}" gs-h="${w.height || w.h}" gs-x="${w.x}" gs-y="${w.y}">
                  ${html}
                </div>`);
               if((w.widget_key || w.id) === 'grafico'){
  					const chartId = document.querySelector('#marketChart');
  					initChart(chartId);
				}

            });
            grid.batchUpdate(false);
          } else {
            addDefaultWidgets();
            if (IS_LOGGED) saveLayoutDebounced();
          }
        })
        .catch(err => {
          console.debug('Caricamento layout fallito, mantengo default:', err.message);
        })
    }

    // Carica (se possibile) il layout salvato
    loadSavedLayoutOrKeepDefault();
    grid.on('change', saveLayoutDebounced);
  } else { 
    addDefaultWidgets();
  }

  grid.on("resizestop", function (event, el) {
  if (el._chart && el._chartArea) {
    resizeMain(el._chart, el._chartArea);
  }
});

});
</script>

</body>
</html>
