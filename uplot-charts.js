/* =============================================================================
 *  uplot-charts.js — engine de gráfico uPlot para o Radar Perene
 * -----------------------------------------------------------------------------
 *  ARTEFATO NOVO E INERTE. Nada carrega este arquivo ainda. Será fiado atrás de
 *  uma flag na integração (Sprint 1). Substitui (futuramente) os SVGs
 *  hand-rolled de radar.js (bigChart/riskPane/scatterChart/dualSpark) por uPlot
 *  de verdade: eixos reais, crosshair, zoom por brush, sync de cursor.
 *
 *  Depende de: vendor/uplot/uPlot.iife.min.js (global `uPlot`) + uPlot.min.css.
 *  Expõe: window.RPUplot = { upPrice, upOscillator, upScatter, upDual, ready }.
 *
 *  CONTRATO DE DADOS — lê o MESMO shape que /v1/serie já devolve (objeto `s`):
 *    s.hist[]            preços por índice (passado, inclui "hoje" no fim)
 *    s.datas[]           datas ISO "YYYY-MM-DD" paralelas a s.hist (X REAL!)
 *    s.proj[]            fallback linear (começa em "hoje" = s.hist.length-1)
 *    s.cone.{mid,lo,hi,lo2,hi2}  quantis futuros; cone.mid[0] = HOJE
 *    s.ma50[], s.ma200[] médias móveis alinhadas a s.hist (podem ter null)
 *    s.fair.serie[]      valor-justo histórico alinhado a s.hist
 *    s.fair.serie_fut[]  valor-justo projetado (futuro)
 *    s.shadow.{lo,hi}[]  cone aplicado ao passado (alinhado a s.hist)
 *    s.bands[]           [{i0,i1,tom}] banding de regime BR (índices em s.hist)
 *    rk.{serie,thr,hi,lo,marks:[{i,tom}]}  oscilador 0-100
 *    sc.{points:[{x:0-100,y:retorno}], cur_x}  scatter Lead-Lag
 *
 *  Pesquisa uPlot aplicada (ver comentários "// uPlot:"):
 *   - bandas/cone:  series com `fill` + `opts.bands[]` (lo/hi via índices de série)
 *   - banding fundo: hooks.draw desenha rects no <canvas> ANTES das séries
 *   - sync cursor:  cursor.sync.key compartilhado entre preço e oscilador
 *   - scatter:      mode:2 + series.paths custom (pontos), scale x linear 0-100
 *   - cores tema:   getComputedStyle do container herda claro/escuro do radar.js
 * ========================================================================== */
(function () {
  "use strict";

  // SSR-safe-ish: só roda no browser. Em SSR vira no-op silencioso.
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // -------------------------------------------------------------------------
  // Helpers de tema: lê as MESMAS variáveis CSS do radar.js via getComputedStyle
  // para herdar claro/escuro. Resolve no elemento-alvo (não no :root) porque o
  // radar.js define as vars no container `.rp`.
  // -------------------------------------------------------------------------
  function theme(el) {
    var cs = getComputedStyle(el);
    function v(name, fb) { var x = cs.getPropertyValue(name); return (x && x.trim()) || fb; }
    return {
      accent: v("--_accent", "#a8651a"),
      warm:   v("--_warm",   "#7a3b0e"),
      cool:   v("--_cool",   "#1a3a5c"),
      dim:    v("--_dim",    "#6e6e78"),
      line:   v("--_line",   "#e6e3dc"),
      hot:    v("--_hot",    "#b02e22"),
      neu:    v("--_neu",    "#9c9c96"),
      txt:    v("--_txt",    "#1a1a2e"),
      card:   v("--_card",   "#ffffff"),
      card2:  v("--_card2",  "#f3f1ec")
    };
  }

  // rgba a partir de uma cor CSS resolvida (hex ou rgb). uPlot fill quer string.
  // Resolve via canvas pra normalizar qualquer formato que o getComputedStyle
  // devolver (rgb(), hex, named) e injeta alpha.
  var _probe;
  function withAlpha(color, a) {
    try {
      _probe = _probe || document.createElement("canvas").getContext("2d");
      _probe.fillStyle = "#000";
      _probe.fillStyle = color;         // navegador normaliza p/ #rrggbb ou rgb()
      var c = _probe.fillStyle;
      if (c[0] === "#") {
        var r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
        return "rgba(" + r + "," + g + "," + b + "," + a + ")";
      }
      var m = c.match(/\d+/g);
      if (m && m.length >= 3) return "rgba(" + m[0] + "," + m[1] + "," + m[2] + "," + a + ")";
    } catch (e) {}
    return color;
  }

  function ready() { return typeof window.uPlot === "function"; }
  function warnNoUplot() { if (typeof console !== "undefined") console.warn("[RPUplot] uPlot global ausente — vendorize vendor/uplot/uPlot.iife.min.js antes de chamar."); }

  // Converte "YYYY-MM-DD" → timestamp em segundos (uPlot usa epoch-segundos no eixo de tempo).
  function dateToTs(d) {
    if (d == null) return null;
    var t = Date.parse(String(d).length <= 10 ? String(d) + "T00:00:00Z" : d);
    return isFinite(t) ? t / 1000 : null;
  }

  // Gera eixo-X de timestamps a partir de s.datas; se faltar, cai pra índice
  // sintético (1 ponto = 1 dia) só pra não quebrar — mas o objetivo É usar datas reais.
  function buildPriceXs(s) {
    var n = s.hist.length;
    var xs = new Array(n);
    var hasDatas = s.datas && s.datas.length === n;
    var step = 86400; // 1 dia
    if (hasDatas) {
      for (var i = 0; i < n; i++) { var ts = dateToTs(s.datas[i]); xs[i] = (ts != null) ? ts : null; }
      // preenche buracos por interpolação simples pra manter o eixo monotônico
      for (var j = 0; j < n; j++) if (xs[j] == null) xs[j] = (j > 0 && xs[j - 1] != null) ? xs[j - 1] + step : (Date.now() / 1000 - (n - j) * step);
    } else {
      var base = Date.now() / 1000 - (n - 1) * step;
      for (var k = 0; k < n; k++) xs[k] = base + k * step;
    }
    return xs;
  }

  // Estende o eixo-X pra frente em `futN` passos, mantendo o passo médio recente.
  function extendXs(xs, futN) {
    var n = xs.length;
    if (futN <= 0) return xs.slice();
    var step = (n > 1) ? (xs[n - 1] - xs[Math.max(0, n - 6)]) / Math.min(5, n - 1) : 86400;
    if (!isFinite(step) || step <= 0) step = 86400;
    var out = xs.slice();
    for (var i = 1; i <= futN; i++) out.push(xs[n - 1] + step * i);
    return out;
  }

  // Alinha um array `arr` (passado, len<=hist) ao comprimento total, padejando com null no futuro.
  function padTail(arr, total) {
    var out = new Array(total);
    for (var i = 0; i < total; i++) out[i] = (arr && i < arr.length && arr[i] != null && isFinite(arr[i])) ? arr[i] : null;
    return out;
  }

  // Coloca uma série FUTURA (começa em "hoje" = índice bi) no array total.
  // cone.mid[0] corresponde a hist[bi]; então mapeia offset 0 → bi.
  function placeFuture(futArr, bi, total) {
    var out = new Array(total);
    for (var i = 0; i < total; i++) out[i] = null;
    if (!futArr) return out;
    for (var k = 0; k < futArr.length; k++) {
      var idx = bi + k;
      if (idx < total && futArr[k] != null && isFinite(futArr[k])) out[idx] = futArr[k];
    }
    return out;
  }

  // Responsividade: observa o tamanho do container e re-dimensiona o uPlot.
  function makeResponsive(u, el) {
    function fit() {
      var w = el.clientWidth || el.offsetWidth || 280;
      if (w && Math.abs(w - u.width) > 1) u.setSize({ width: w, height: u.height });
    }
    if (typeof ResizeObserver === "function") {
      var ro = new ResizeObserver(fit); ro.observe(el);
      u._rpRO = ro; // guarda pra cleanup externo se preciso
    } else {
      window.addEventListener("resize", fit);
    }
    return fit;
  }

  // ── LINK GROUP de JANELA-X (empilhamento SentimenTrader): cursor.sync do uPlot só sincroniza o CROSSHAIR,
  //    NÃO o zoom/período. Sem isto, o preço ia p/ 6M mas Ânima/risk ficavam na história inteira (achatados/desalinhados).
  //    Aqui: gráficos com a MESMA chave (opt.sync) compartilham min/max do eixo-X — qualquer setScale (período, wheel,
  //    pan) propaga aos irmãos. Guard _linkBusy evita laço. O ÚLTIMO a setar a janela vence (orquestrado no radar.js:
  //    osciladores montam ANTES, o preço por último impõe a janela correta). ──
  var _links = {};
  function linkRegister(u, key) { if (!key) return u; (_links[key] = _links[key] || []).push(u); u._linkKey = key; return u; }
  function linkScaleHook(key) {
    return function (u, scaleKey) {
      if (scaleKey !== "x" || !key || u._linkBusy) return;
      var grp = _links[key]; if (!grp) return;
      var mn = u.scales.x.min, mx = u.scales.x.max; if (mn == null || mx == null) return;
      for (var i = 0; i < grp.length; i++) { var o = grp[i];
        if (o === u || !o.scales || !o.scales.x) continue;
        if (o.scales.x.min !== mn || o.scales.x.max !== mx) { o._linkBusy = true; try { o.setScale("x", { min: mn, max: mx }); } catch (e) {} o._linkBusy = false; }
      }
    };
  }
  // Limpa um container antes de (re)desenhar — idempotente p/ re-render.
  // destrói a instância uPlot anterior (se houver): u.destroy() DESREGISTRA do grupo de cursor.sync e do ResizeObserver →
  // sem isso, toggle de horizonte / re-tema deixariam fantasmas no sync desenhando em canvas solto. Guardamos em el._rpU.
  function clear(el) {
    if (el && el._rpU) {
      var u = el._rpU;
      if (u._linkKey && _links[u._linkKey]) { var g = _links[u._linkKey], ix = g.indexOf(u); if (ix >= 0) g.splice(ix, 1); }
      try { u.destroy(); } catch (e) {} el._rpU = null;
    }
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }
  function keep(el, u) { try { el._rpU = u; } catch (e) {} return u; }  // registra a instância viva p/ o próximo clear destruir

  // =========================================================================
  // navPlugin — a "sensação TradingView": WHEEL = zoom-x em torno do cursor,
  // DRAG = pan-x (arrasta o tempo), DBLCLICK = reset. Com cursor.sync.scales=["x"]
  // o zoom/pan se propaga aos painéis empilhados (preço↔Ânima↔risk) na mesma janela.
  // Listeners de move/up são presos a `document` SÓ durante o arraste (auto-cleanup,
  // sem vazar ao fechar o modal). Cuida só do eixo-X (preço/osc mantêm seu Y).
  // =========================================================================
  function navPlugin(opt) {
    opt = opt || {};
    return { hooks: { ready: [function (u) {
      var over = u.over;
      over.style.cursor = "grab";
      // WHEEL → zoom-x ancorado na posição do cursor (in = aproxima; out = afasta)
      over.addEventListener("wheel", function (e) {
        e.preventDefault();
        var rect = over.getBoundingClientRect(), w = rect.width || 1;
        var leftPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / w));
        var xMin = u.scales.x.min, xMax = u.scales.x.max, rng = xMax - xMin;
        if (!isFinite(rng) || rng <= 0) return;
        var z = e.deltaY < 0 ? 0.82 : 1.22;                 // scroll p/ cima = zoom-in
        var nRng = rng * z, anchor = xMin + leftPct * rng;
        u.setScale("x", { min: anchor - leftPct * nRng, max: anchor + (1 - leftPct) * nRng });
      }, { passive: false });
      // DRAG → pan-x; listeners no document só enquanto arrasta (auto-cleanup)
      over.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        var sx = e.clientX, m0 = u.scales.x.min, M0 = u.scales.x.max, w = over.getBoundingClientRect().width || 1;
        if (!isFinite(M0 - m0)) return;
        over.style.cursor = "grabbing";
        function mv(ev) { var dx = (ev.clientX - sx) / w * (M0 - m0); u.setScale("x", { min: m0 - dx, max: M0 - dx }); }
        function up() { over.style.cursor = "grab"; document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); }
        document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
      });
      // DBLCLICK → reset à janela cheia (callback de quem montou; senão auto-range)
      over.addEventListener("dblclick", function () { if (opt.onReset) opt.onReset(u); else u.setScale("x", { min: u.data[0][0], max: u.data[0][u.data[0].length - 1] }); });
    }] } };
  }

  // =========================================================================
  // 1) upPrice — preço por DATAS REAIS + cone de quantis + MMs + fair + shadow
  //    + banding de regime no fundo + linha vertical "hoje".
  //    opt.pro: true mostra cone completo (p10–p90); false mostra só mediana (free).
  //    opt.sync: chave de sync de cursor (compartilha eixo-X com o oscilador).
  // =========================================================================
  function upPrice(el, s, opt) {
    if (!ready()) { warnNoUplot(); return null; }
    if (!el || !s || !s.hist || s.hist.length < 2) return null;
    opt = opt || {};
    var pro = !!opt.pro;
    var T = theme(el);
    clear(el);

    var hist = s.hist;
    var bi = hist.length - 1;                                  // índice de "hoje"
    var cone = (s.cone && s.cone.mid && s.cone.mid.length > 1) ? s.cone : null;
    var proj = (!cone && s.proj && s.proj.length > 1) ? s.proj : null;
    var futN = cone ? (cone.mid.length - 1) : (proj ? proj.length - 1 : 0);

    var xsHist = buildPriceXs(s);
    var xs = extendXs(xsHist, futN);
    var total = xs.length;

    // Série de preço histórica (resto null no futuro).
    var price = padTail(hist, total);

    // ---- séries de dados (paralelas a xs) ----
    // Ordem importa p/ bands (índices de série). Mantemos:
    //  0:x  1:price  2:ma200  3:ma50  4:fair  5:coneMid
    //  6:coneHi 7:coneLo  8:coneHi2 9:coneLo2  10:shadowHi 11:shadowLo
    var ma200 = s.ma200 ? padTail(s.ma200, total) : null;
    var ma50  = s.ma50  ? padTail(s.ma50,  total) : null;

    // valor-justo: histórico + futuro projetado emendados (futuro a partir de bi+1).
    var fair = null;
    if (s.fair && s.fair.serie && s.fair.serie.length) {
      fair = padTail(s.fair.serie, total);
      if (s.fair.serie_fut && s.fair.serie_fut.length && (cone || proj)) {
        // conecta do último fair histórico (em bi) e estende
        for (var ff = 0; ff < s.fair.serie_fut.length; ff++) {
          var fidx = bi + 1 + ff;
          if (fidx < total && s.fair.serie_fut[ff] != null) fair[fidx] = s.fair.serie_fut[ff];
        }
      }
    }

    // cone (futuro, começa em hoje). placeFuture: offset0 → bi.
    var coneMid = cone ? placeFuture(cone.mid, bi, total) : null;
    var coneHi  = (cone && pro) ? placeFuture(cone.hi, bi, total) : null;
    var coneLo  = (cone && pro) ? placeFuture(cone.lo, bi, total) : null;
    var coneHi2 = (cone && pro && cone.hi2) ? placeFuture(cone.hi2, bi, total) : null;
    var coneLo2 = (cone && pro && cone.lo2) ? placeFuture(cone.lo2, bi, total) : null;
    // fallback projeção linear quando não há cone
    var projSer = proj ? placeFuture(proj, bi, total) : null;

    // shadow (passado): cone aplicado ao histórico — só no modo pro.
    var shadowHi = (pro && s.shadow && s.shadow.hi) ? padTail(s.shadow.hi, total) : null;
    var shadowLo = (pro && s.shadow && s.shadow.lo) ? padTail(s.shadow.lo, total) : null;

    // monta data[] e series[] dinamicamente (só inclui o que existe).
    var data = [xs];
    var series = [{}]; // x
    var bands = [];    // uPlot: bands[] preenchem ENTRE pares de séries (hi acima de lo)

    function addSeries(arr, conf) { data.push(arr); series.push(conf); return series.length - 1; }

    // preço (linha principal)
    var iPrice = addSeries(price, {
      label: "preço", stroke: T.accent, width: 1.6,
      // fill gradiente sob a linha (profundidade grau-TradingView)
      fill: function (u) {
        try {
          var g = u.ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
          g.addColorStop(0, withAlpha(T.accent, 0.20));
          g.addColorStop(1, withAlpha(T.accent, 0));
          return g;
        } catch (e) { return withAlpha(T.accent, 0.08); }
      },
      points: { show: false }
    });

    var iMa200 = ma200 ? addSeries(ma200, { label: "MM200", stroke: T.cool, width: 1.0, points: { show: false } }) : -1;
    var iMa50  = ma50  ? addSeries(ma50,  { label: "MM50", stroke: T.dim,  width: 1.0, dash: [3, 3], points: { show: false } }) : -1;
    var iFair  = fair  ? addSeries(fair,  { label: "valor-justo", stroke: T.warm, width: 1.4, dash: [4, 2], points: { show: false } }) : -1;

    // cone externo p10–p90 (banda clara) — desenhada primeiro pra ficar atrás.
    // uPlot: a banda entre series[hi] e series[lo] via opts.bands[{series:[hi,lo], fill}].
    if (coneHi2 && coneLo2) {
      var iHi2 = addSeries(coneHi2, { label: "p90", stroke: withAlpha(T.warm, 0.4), width: 0.5, points: { show: false } });
      var iLo2 = addSeries(coneLo2, { label: "p10", stroke: withAlpha(T.warm, 0.4), width: 0.5, points: { show: false } });
      bands.push({ series: [iHi2, iLo2], fill: withAlpha(T.warm, 0.07) });
    }
    // cone interno p25–p75 (banda mais densa).
    if (coneHi && coneLo) {
      var iHi = addSeries(coneHi, { label: "p75", stroke: withAlpha(T.warm, 0.55), width: 0.6, points: { show: false } });
      var iLo = addSeries(coneLo, { label: "p25", stroke: withAlpha(T.warm, 0.55), width: 0.6, points: { show: false } });
      bands.push({ series: [iHi, iLo], fill: withAlpha(T.warm, 0.13) });
    }
    // mediana (tracejada) — sempre, free vê só ela.
    if (coneMid) addSeries(coneMid, { label: "mediana", stroke: T.warm, width: 1.4, dash: [4, 2], points: { show: false } });
    else if (projSer) addSeries(projSer, { label: "projeção", stroke: T.warm, width: 1.4, dash: [4, 2], points: { show: false } });

    // shadow (passado): banda entre shadowHi e shadowLo.
    if (shadowHi && shadowLo) {
      var iSh = addSeries(shadowHi, { label: "sombra+", stroke: withAlpha(T.warm, 0.3), width: 0.4, points: { show: false } });
      var iShLo = addSeries(shadowLo, { label: "sombra-", stroke: withAlpha(T.warm, 0.3), width: 0.4, points: { show: false } });
      bands.push({ series: [iSh, iShLo], fill: withAlpha(T.warm, 0.10) });
    }

    // plugins (Bollinger etc.): {up,lo,mid} alinhados a hist → séries de linha tracejadas (paridade com o SVG bigChart).
    if (s._plugins && s._plugins.length) {
      for (var pgi = 0; pgi < s._plugins.length; pgi++) {
        var pc = s._plugins[pgi].data, pid = s._plugins[pgi].id; if (!pc) continue;
        if (pc.up)  addSeries(padTail(pc.up,  total), { label: pid + "↑",  stroke: T.cool, width: 0.7, dash: [3, 2], points: { show: false } });
        if (pc.lo)  addSeries(padTail(pc.lo,  total), { label: pid + "↓",  stroke: T.cool, width: 0.7, dash: [3, 2], points: { show: false } });
        if (pc.mid) addSeries(padTail(pc.mid, total), { label: pid + " ·", stroke: T.dim,  width: 0.55, dash: [1, 2], points: { show: false } });
      }
    }

    // timestamp de "hoje" (pra linha vertical e split passado/futuro do fundo).
    var todayTs = xs[bi];

    // ---- banding de regime + linha "hoje": desenhados no <canvas> via hook draw,
    //      ANTES das séries (drawClear roda no começo do ciclo de desenho). ----
    function drawBackground(u) {
      var ctx = u.ctx, top = u.bbox.top, h = u.bbox.height;
      // banding de regime BR (s.bands = [{i0,i1,tom}], índices em s.hist → datas → x → px)
      if (s.bands && s.bands.length) {
        for (var b = 0; b < s.bands.length; b++) {
          var bd = s.bands[b];
          var x0 = xs[Math.max(0, Math.min(total - 1, bd.i0))];
          var x1 = xs[Math.max(0, Math.min(total - 1, (bd.i1 != null ? bd.i1 : bd.i0) + 1))];
          var px0 = u.valToPos(x0, "x", true), px1 = u.valToPos(x1, "x", true);
          ctx.fillStyle = withAlpha(T[bd.tom] || T.neu, 0.06);
          ctx.fillRect(px0, top, Math.max(0, px1 - px0), h);
        }
      }
      // região futura (sutil warm) — "daqui pra frente é OUTRA COISA": leque de desfechos análogos, não preço observado. Sempre (com ou sem cone) p/ bater o olho.
      if (futN > 0) {
        var pxToday = u.valToPos(todayTs, "x", true);
        ctx.fillStyle = withAlpha(T.warm, 0.045);
        ctx.fillRect(pxToday, top, Math.max(0, u.bbox.left + u.bbox.width - pxToday), h);
      }
    }
    function drawTodayLine(u) {
      // âncora "hoje" — a referência ABSOLUTA do gráfico: tudo (cone/leque) nasce dela. Desenhada DEPOIS das séries.
      var ctx = u.ctx, top = u.bbox.top, h = u.bbox.height;
      var px = u.valToPos(todayTs, "x", true);
      ctx.save();
      ctx.strokeStyle = withAlpha(T.accent, 0.9);
      ctx.lineWidth = 1.3; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, top + h); ctx.stroke();
      if (opt.todayLabel !== false) { // etiqueta discreta "hoje/now" no topo da âncora
        var lab = opt.lang === "en" ? "now" : "hoje";
        ctx.font = "9px ui-monospace, monospace"; ctx.textBaseline = "top";
        var tw = ctx.measureText(lab).width + 6;
        ctx.fillStyle = withAlpha(T.accent, 0.92); ctx.fillRect(px + 1, top + 1, tw, 12);
        ctx.fillStyle = T.card; ctx.fillText(lab, px + 4, top + 3);
      }
      ctx.restore();
    }
    // ── marcadores de SINAL (pinos datados): buy signal do Índice de Risco Perene (range-rank <5%→>68.5%).
    //    Triângulo ▲ no rodapé na data do trigger (P7: marca o evento histórico, não recomenda). opt.sinais = [{data,tipo}].
    function drawSignals(u) {
      if (!opt.sinais || !opt.sinais.length) return;
      var ctx = u.ctx, top = u.bbox.top, h = u.bbox.height, yb = top + h;
      var xmin = u.scales.x.min, xmax = u.scales.x.max;
      ctx.save();
      for (var i = 0; i < opt.sinais.length; i++) {
        var sg = opt.sinais[i], ts = dateToTs(sg.data); if (ts == null || ts < xmin || ts > xmax) continue;
        var px = u.valToPos(ts, "x", true);
        var up = !/off|down|pessim/.test(String(sg.tipo || ""));        // buy/risk-on = ▲ verde-âmbar; risk-off = ▼
        var col = up ? T.accent : T.hot;
        ctx.strokeStyle = withAlpha(col, 0.45); ctx.lineWidth = 0.8; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, yb); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = col;                       // triângulo na base
        var ty = up ? yb - 1 : top + 1, dir = up ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(px, ty); ctx.lineTo(px - 4, ty + dir * 6); ctx.lineTo(px + 4, ty + dir * 6); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    var cursor = { points: { show: false }, drag: { x: false, y: false } };  // brush nativo OFF → navPlugin cuida de zoom(wheel)/pan(drag), sensação TradingView. points OFF evita addClass(undefined) com séries esparsas (cone só-futuro).
    if (opt.sync) cursor.sync = { key: opt.sync, scales: ["x", null] }; // uPlot: compartilha crosshair E janela-x (zoom/pan) entre os painéis empilhados — Y de cada um independente

    var opts = {
      width: el.clientWidth || 280,
      height: opt.height || (opt.big === false ? 60 : 150),
      // tema/fonte do uPlot herdados do container
      cursor: cursor,
      legend: { show: true },                        // readout AO VIVO: data na posição da cruz + valor de cada série ali
      scales: { x: { time: true } },                 // eixo-X temporal de verdade
      axes: [
        { show: !opt.hideX, stroke: T.dim, grid: { stroke: withAlpha(T.line, 0.6), width: 0.5 }, ticks: { stroke: withAlpha(T.line, 0.6) }, font: "10px ui-monospace, monospace" },
        { stroke: T.dim, grid: { stroke: withAlpha(T.line, 0.5), width: 0.5 }, ticks: { stroke: withAlpha(T.line, 0.5) }, font: "10px ui-monospace, monospace", size: opt.axisW || 44 } // size = calha-Y fixa: empilhado, todos os painéis usam o MESMO → o crosshair alinha na vertical
      ],
      series: series,
      bands: bands,                                  // uPlot: preenche entre pares de séries
      plugins: [navPlugin({ onReset: opt.onReset })], // wheel-zoom + drag-pan (sensação TradingView)
      hooks: {
        drawClear: [drawBackground],                 // fundo (banding/regime) antes das séries
        draw: [drawTodayLine, drawSignals],           // âncora "hoje" + pinos de sinal (buy signal Risco Perene)
        setScale: [linkScaleHook(opt.sync)]           // janela-x propaga aos painéis empilhados (período/wheel/pan)
      }
    };

    var u = new window.uPlot(opts, data, el);
    makeResponsive(u, el);
    linkRegister(u, opt.sync);
    return keep(el, u);
  }

  // =========================================================================
  // 2) upOscillator — oscilador 0–100 com threshold, zonas hi/lo, marcas de extremo.
  //    Cursor SINCRONIZÁVEL (opt.sync) pra empilhar sob o preço compartilhando X.
  // =========================================================================
  function upOscillator(el, rk, opt) {
    if (!ready()) { warnNoUplot(); return null; }
    if (!el || !rk || !rk.serie || rk.serie.length < 2) return null;
    opt = opt || {};
    var T = theme(el);
    clear(el);

    var serie = rk.serie, n = serie.length;
    // X: usa datas se vierem junto (opt.datas) — pra alinhar com o preço; senão índice sintético.
    var xs = new Array(n);
    if (opt.datas && opt.datas.length === n) {
      for (var i = 0; i < n; i++) { var ts = dateToTs(opt.datas[i]); xs[i] = (ts != null) ? ts : (Date.now() / 1000 - (n - i) * 86400); }
    } else {
      var base = Date.now() / 1000 - (n - 1) * 86400;
      for (var k = 0; k < n; k++) xs[k] = base + k * 86400;
    }

    var data = [xs, serie];
    var thr = (rk.thr != null) ? rk.thr : 50;
    var hi = (rk.hi != null) ? rk.hi : 70, lo = (rk.lo != null) ? rk.lo : 30;

    function drawZones(u) {
      // zonas de extremo (hot acima de hi, cool abaixo de lo) + linhas threshold.
      var ctx = u.ctx, left = u.bbox.left, w = u.bbox.width;
      function yOf(val) { return u.valToPos(val, "y", true); }
      // zona risco-off (topo)
      var yHi = yOf(hi), yTop = u.bbox.top;
      ctx.fillStyle = withAlpha(T.hot, 0.06);
      ctx.fillRect(left, yTop, w, Math.max(0, yHi - yTop));
      // zona risco-on (base)
      var yLo = yOf(lo), yBot = u.bbox.top + u.bbox.height;
      ctx.fillStyle = withAlpha(T.cool, 0.06);
      ctx.fillRect(left, yLo, w, Math.max(0, yBot - yLo));
    }
    function drawLines(u) {
      var ctx = u.ctx, left = u.bbox.left, w = u.bbox.width;
      function line(val, color, dash) {
        var y = u.valToPos(val, "y", true);
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 0.6; ctx.setLineDash(dash || []);
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + w, y); ctx.stroke(); ctx.restore();
      }
      line(hi, withAlpha(T.hot, 0.6), [3, 2]);
      line(lo, withAlpha(T.cool, 0.6), [3, 2]);
      line(thr, withAlpha(T.line, 1), []);
      // marcas de extremo no rodapé (sem direção de trade — só alerta)
      if (rk.marks && rk.marks.length) {
        var yb = u.bbox.top + u.bbox.height;
        for (var m = 0; m < rk.marks.length; m++) {
          var mk = rk.marks[m];
          if (mk.i == null || mk.i >= n) continue;
          var px = u.valToPos(xs[mk.i], "x", true);
          ctx.save(); ctx.strokeStyle = T[mk.tom] || T.neu; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(px, yb - 4); ctx.lineTo(px, yb); ctx.stroke(); ctx.restore();
        }
      }
    }

    var cursor = { points: { show: false }, drag: { x: false, y: false } };      // points OFF (mesma higiene do upPrice) + brush OFF (nav via navPlugin): a Ânima/risk têm nulls no início (forward-fill) → série esparsa → cursor.points nativo quebra (addClass undefined / 'contains'); crosshair + sync seguem pela linha vertical
    if (opt.sync) cursor.sync = { key: opt.sync, scales: ["x", null] };           // empilhado: compartilha crosshair E janela-x com o preço (Y 0–100 próprio)

    var u = new window.uPlot({
      width: el.clientWidth || 280,
      height: opt.height || (opt.big === false ? 40 : 70),
      cursor: cursor,
      legend: { show: false },
      scales: { x: { time: !!(opt.datas) }, y: { range: [0, 100] } }, // oscilador travado 0–100
      axes: [
        { show: !opt.hideX, stroke: T.dim, grid: { stroke: withAlpha(T.line, 0.5), width: 0.5 }, font: "10px ui-monospace, monospace" }, // empilhado: eixo-X (datas) só no painel de baixo
        { stroke: T.dim, grid: { show: false }, font: "10px ui-monospace, monospace", size: opt.axisW || 30, values: function (u, sp) { return sp.map(function (v) { return v; }); } }
      ],
      series: [
        {},
        { label: "osc", stroke: T.accent, width: 1.3, points: { show: false } }
      ],
      plugins: opt.nav ? [navPlugin({ onReset: opt.onReset })] : [],
      hooks: {
        drawClear: [drawZones],
        draw: [drawLines],
        setScale: [linkScaleHook(opt.sync)]           // janela-x propaga aos painéis empilhados (preço↔Ânima↔risk)
      }
    }, data, el);
    makeResponsive(u, el);
    linkRegister(u, opt.sync);
    return keep(el, u);
  }

  // =========================================================================
  // 3) upScatter — scatter de quadrantes Lead-Lag. Eixo-X numérico 0–100 (regime),
  //    Y = retorno. Zonas ganho/perda coloridas + linha vertical "hoje" (cur_x).
  //    uPlot: mode:2 (séries facetadas X/Y) com paths.points pra desenhar marcadores.
  // =========================================================================
  function upScatter(el, sc) {
    if (!ready()) { warnNoUplot(); return null; }
    if (!el || !sc || !sc.points || sc.points.length < 2) return null;
    var T = theme(el);
    clear(el);

    var pts = sc.points;
    var xsUp = [], ysUp = [], xsDn = [], ysDn = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p.y >= 0) { xsUp.push(p.x); ysUp.push(p.y); }
      else { xsDn.push(p.x); ysDn.push(p.y); }
    }

    // uPlot mode:2 — cada série é [ [xVals], [yVals] ]; data[0] é ignorado (placeholder).
    var data = [
      null,
      [xsUp, ysUp],
      [xsDn, ysDn]
    ];

    // paths.points: desenha cada ponto como quadradinho (reproduz os rects 2×2 do SVG).
    function squarePaths(color, size) {
      return function (u, sidx) {
        var s = u.series[sidx], scaleX = u.series[0].scale || "x";
        var d = u.data[sidx];
        u.ctx.save();
        u.ctx.fillStyle = color;
        var xv = d[0], yv = d[1];
        for (var j = 0; j < xv.length; j++) {
          var px = u.valToPos(xv[j], "x", true);
          var py = u.valToPos(yv[j], "y", true);
          u.ctx.fillRect(px - size, py - size, size * 2, size * 2);
        }
        u.ctx.restore();
        return null; // já desenhamos manualmente; sem path nativo
      };
    }

    function drawZones(u) {
      // zonas ganho (>0 warm) / perda (<0 cool) + eixo y=0 + linha vertical x=50.
      var ctx = u.ctx, left = u.bbox.left, w = u.bbox.width, top = u.bbox.top, h = u.bbox.height;
      var yRange = u.scales.y;
      var y0 = (yRange.min < 0 && yRange.max > 0) ? u.valToPos(0, "y", true) : null;
      if (y0 != null) {
        ctx.fillStyle = withAlpha(T.warm, 0.045);
        ctx.fillRect(left, top, w, Math.max(0, y0 - top));
        ctx.fillStyle = withAlpha(T.cool, 0.045);
        ctx.fillRect(left, y0, w, Math.max(0, (top + h) - y0));
        ctx.save(); ctx.strokeStyle = withAlpha(T.line, 1); ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(left, y0); ctx.lineTo(left + w, y0); ctx.stroke(); ctx.restore();
      }
      // linha vertical x=50 (divisor de regime)
      var px50 = u.valToPos(50, "x", true);
      ctx.save(); ctx.strokeStyle = withAlpha(T.line, 1); ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(px50, top); ctx.lineTo(px50, top + h); ctx.stroke(); ctx.restore();
    }
    function drawToday(u) {
      if (sc.cur_x == null) return;
      var ctx = u.ctx, top = u.bbox.top, h = u.bbox.height;
      var px = u.valToPos(Math.max(0, Math.min(100, sc.cur_x)), "x", true);
      ctx.save(); ctx.strokeStyle = T.accent; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]);
      ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, top + h); ctx.stroke(); ctx.restore();
    }

    var u = new window.uPlot({
      mode: 2,                                          // uPlot: modo facetado X/Y p/ scatter
      width: el.clientWidth || 280,
      height: 150,
      cursor: { drag: { setScale: false }, points: { show: false } },
      legend: { show: false },
      scales: {
        x: { range: [0, 100] },                         // regime 0–100 (linear, não-temporal)
        y: { range: function (u, dmin, dmax) { var pad = (dmax - dmin) * 0.06 || 1; return [dmin - pad, dmax + pad]; } }
      },
      axes: [
        { stroke: T.dim, grid: { stroke: withAlpha(T.line, 0.45), width: 0.5 }, font: "10px ui-monospace, monospace" },
        { stroke: T.dim, grid: { stroke: withAlpha(T.line, 0.4), width: 0.5 }, font: "10px ui-monospace, monospace", size: 36 }
      ],
      series: [
        {},
        { stroke: T.warm, fill: withAlpha(T.warm, 0.5), paths: squarePaths(withAlpha(T.warm, 0.6), 1.4), points: { show: false } },
        { stroke: T.cool, fill: withAlpha(T.cool, 0.5), paths: squarePaths(withAlpha(T.cool, 0.6), 1.4), points: { show: false } }
      ],
      hooks: {
        drawClear: [drawZones],
        draw: [drawToday]
      }
    }, data, el);
    makeResponsive(u, el);
    return keep(el, u);
  }

  // =========================================================================
  // 4) upDual — 2 séries normalizadas + razão tracejada, rebaseadas a 100.
  //    a, b: séries; c (opcional): razão. Reproduz dualSpark.
  // =========================================================================
  function upDual(el, a, b, c) {
    if (!ready()) { warnNoUplot(); return null; }
    if (!el || !a || !b || a.length < 2) return null;
    var T = theme(el);
    clear(el);

    // rebaseia a 100 pelo primeiro ponto não-nulo (par curado já costuma vir [0,100],
    // mas rebaseamos pra garantir comparabilidade visual quando vier cru).
    function rebase(arr) {
      if (!arr) return null;
      var base0 = null;
      for (var i = 0; i < arr.length; i++) if (arr[i] != null && isFinite(arr[i])) { base0 = arr[i]; break; }
      if (base0 == null || base0 === 0) return arr.slice();
      return arr.map(function (v) { return (v != null && isFinite(v)) ? (v / base0) * 100 : null; });
    }

    var n = a.length;
    var xs = new Array(n);
    var base = Date.now() / 1000 - (n - 1) * 86400;
    for (var i = 0; i < n; i++) xs[i] = base + i * 86400; // X sintético uniforme (sem datas no shape do par)

    var ra = rebase(a), rb = rebase(b), rc = (c && c.length) ? rebase(c) : null;
    var data = [xs, ra, rb];
    var series = [
      {},
      { label: "A", stroke: T.accent, width: 1.4, points: { show: false } },
      { label: "B", stroke: T.cool, width: 1.4, points: { show: false } }
    ];
    if (rc) { data.push(rc); series.push({ label: "razão", stroke: T.warm, width: 2, dash: [5, 2], points: { show: false } }); }

    var u = new window.uPlot({
      width: el.clientWidth || 280,
      height: 60,
      cursor: { points: { show: true } },
      legend: { show: false },
      scales: { x: { time: false } },
      axes: [
        { stroke: T.dim, grid: { stroke: withAlpha(T.line, 0.4), width: 0.5 }, show: false },
        { stroke: T.dim, grid: { stroke: withAlpha(T.line, 0.4), width: 0.5 }, font: "10px ui-monospace, monospace", size: 34 }
      ],
      series: series
    }, data, el);
    makeResponsive(u, el);
    return keep(el, u);
  }

  // -------------------------------------------------------------------------
  window.RPUplot = {
    ready: ready,
    theme: theme,          // exposto p/ a integração herdar paleta se precisar
    upPrice: upPrice,
    upOscillator: upOscillator,
    upScatter: upScatter,
    upDual: upDual
  };
})();
