/*! Radar Perene — widget embedável (drop-in, temável, auto-atualiza). MIT-ish: use livre citando a fonte.
 *  Uso em QUALQUER site (HTML, WordPress, React, etc.):
 *    <div id="radar-perene" data-lang="pt"></div>
 *    <script src="https://radarperene.com/radar.js" defer></script>
 *  Identidade própria: defina variáveis CSS no container (ou no :root):
 *    #radar-perene{ --rp-accent:#0aa; --rp-bg:#fff; --rp-txt:#111; --rp-card:#f4f4f4; --rp-line:#e2e2e2; --rp-dim:#666 }
 *    + ganchos finos: --rp-radius, --rp-max, --rp-hot/warm/cool, --rp-font/mono,
 *      --rp-card-border, --rp-chip-bg, --rp-number-weight, --rp-number-font, --rp-space
 *  Skin pronto (premium "quiet luxury", opt-in): <div id="radar-perene" data-skin="editorial">
 *    → hairlines no lugar de cards, números serif leves, paleta contida, mais ar. Default = marca Radar Perene.
 *  Dado: API pública (CORS aberto). P7: descritivo, nunca recomenda. Atualiza ao carregar a página.
 */
(function () {
  // endereço absoluto do próprio radar.js — currentScript é válido AGORA (defer, exec síncrona), vira null no callback do boot.
  var RP_SRC = (document.currentScript && document.currentScript.src) || "";
  var API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/digest";
  // anon key pública do Supabase (feita p/ viver no client — vive no bundle de todo site Supabase;
  // o gateway exige um JWT válido, a proteção real é a RLS/função que só expõe o digest curado).
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjanRrZ2x0cnhkbmxhY2V6cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTk3MDQsImV4cCI6MjA5NTc5NTcwNH0.CkEmnGCSTfF-9FjjebyeBUFV0-vW6CsfpyBea6cLCUs";
  var FOPT = { headers: { apikey: ANON, Authorization: "Bearer " + ANON } };
  var RP_CAT = [];  // catálogo de séries cruzáveis (estúdio) — montado no render a partir do digest, cresce sozinho com novos tickers
  var STYLE_ID = "rp-radar-style";

  // ── Sprint 1: engine de gráfico atrás de flag. Default = SVG legado (zero mudança). ─────────────
  //    Liga com ?engine=uplot OU localStorage rp-engine="uplot". O embed de terceiros NUNCA liga
  //    (sem query/sem localStorage → "svg"), então percorre o caminho SVG byte-idêntico de hoje e
  //    sequer baixa vendor/uplot. Toda a lógica nova abaixo vive atrás de uplotOn()/RP_ENGINE.
  var RP_ENGINE = (function () {
    try {
      var q = new URLSearchParams(location.search).get("engine");
      if (q === "uplot" || q === "svg") { localStorage.setItem("rp-engine", q); return q; }
      // NOSSAS páginas (home + /ativo) definem window.RP_ENGINE_DEFAULT="uplot" antes do radar.js → engine rica.
      // O embed de TERCEIROS não define nada (nem query, nem global) → "svg" byte-idêntico, backlink/SEO intactos.
      return localStorage.getItem("rp-engine") || (typeof window !== "undefined" && window.RP_ENGINE_DEFAULT === "uplot" ? "uplot" : "svg");
    } catch (e) { return "svg"; }
  })();
  // quais gráficos já migraram p/ uPlot (os demais seguem SVG mesmo com a flag on). Herói + osciladores empilhados (Ânima/risk).
  var RP_UP = { price: true, osc: true, scatter: false, dual: false };
  var _syncSeq = 0;  // contador de chaves de sync (1 grupo de crosshair/janela por gráfico empilhado)
  // true só quando a flag pede E a engine carregou (RPUplot.ready()). Senão → SVG (degrada gracioso).
  function uplotOn() { return RP_ENGINE === "uplot" && window.RPUplot && window.RPUplot.ready(); }

  // Carrega vendor/uplot + uplot-charts SÓ se a flag pedir; resolve quando a engine estiver pronta.
  // Flag off → nunca baixa nada (cb imediato). onerror→cb mantém o widget vivo em SVG se o asset falhar.
  function ensureUplot(cb) {
    if (RP_ENGINE !== "uplot") return cb();                  // flag off → caminho legado, zero download
    if (window.RPUplot && window.RPUplot.ready()) return cb();
    var base = (RP_SRC || "radar.js").replace(/radar\.js(\?.*)?$/, "");  // src absoluto (capturado no topo) → vendor carrega de radarperene.com/vendor/ em qq página/embed, não relativo a /ativo/…
    function load(tag, attr, url, onload) { var e = document.createElement(tag); e[attr] = url; if (tag === "link") e.rel = "stylesheet"; e.onload = onload; e.onerror = onload; (document.head || document.body).appendChild(e); }
    load("link", "href", base + "vendor/uplot/uPlot.min.css");
    load("script", "src", base + "vendor/uplot/uPlot.iife.min.js", function () {
      load("script", "src", base + "uplot-charts.js", function () { cb(); });   // engine só depois do vendor
    });
  }

  // Registro dos uPlots montados (p/ re-tema): cada item re-desenha a si mesmo. flushUp() popula.
  var _upMounted = [];
  function rpRedrawUplots() {  // canvas não herda var CSS ao vivo → re-instancia no toque de tema
    for (var i = _upMounted.length - 1; i >= 0; i--) {
      var m = _upMounted[i];
      if (!m.el || !m.el.isConnected) { _upMounted.splice(i, 1); continue; }  // desmontado (modal fechado) → descarta
      try { m.draw(m.el); } catch (e) {}
    }
  }

  // ── REGISTRO DE CAMADAS (Strategy/Factory) — fonte única dos overlays do gráfico ──────────────
  // Cada camada se descreve: id, rótulo, default, disponibilidade. 'core' = desenhada pelo bigChart
  // (acoplada às escalas, estável — NÃO mexer). 'plugin' = traz o próprio compute+draw → indicador
  // DROP-IN (some os booleans ad-hoc; novo indicador = nova entrada aqui, sem tocar no bigChart/toggles).
  function rpSMAband(hist, per, k) {  // Bollinger: SMA(per) ± k·σ — base do 1º plugin
    per = per || 20; k = k || 2; var up = [], lo = [], mid = [];
    for (var i = 0; i < hist.length; i++) {
      if (i < per - 1) { up.push(null); lo.push(null); mid.push(null); continue; }
      var sm = 0; for (var a = i - per + 1; a <= i; a++) sm += hist[a]; var m = sm / per;
      var vv = 0; for (var b = i - per + 1; b <= i; b++) vv += (hist[b] - m) * (hist[b] - m); var sd = Math.sqrt(vv / per);
      mid.push(m); up.push(m + k * sd); lo.push(m - k * sd);
    }
    return { up: up, lo: lo, mid: mid };
  }
  var RP_LAYERS = [
    { id: "cone",  kind: "core", defaultOn: true,  available: function (s) { return !!(s.cone && s.cone.mid && s.cone.mid.length > 1); }, label: function (c) { return c.L ? "Cone + shadow" : "Cone + sombra"; } },
    { id: "ma200", kind: "core", defaultOn: false, available: function (s) { return s.ma200 && s.ma200.length; }, label: function (c) { return "MM" + c.ml + c.mu; } },
    { id: "ma50",  kind: "core", defaultOn: false, available: function (s) { return s.ma50 && s.ma50.length; }, label: function (c) { return "MM" + c.mc + c.mu; } },
    { id: "fair",  kind: "core", defaultOn: false, available: function (s) { return !!s.fair; }, label: function (c) { return "Valuation (Lyn Alden)"; } },  // default OFF: o valor-justo costuma ficar longe do preço e esticaria o eixo, achatando o cone; entra por toggle (Founder)
    { id: "bands", kind: "core", defaultOn: false, available: function (s) { return s.bands && s.bands.length; }, label: function (c) { return c.L ? "Regime bands" : "Bandas regime"; } },
    // ── 1º PLUGIN drop-in (prova da arquitetura): Bollinger (20,2), computado do hist no cliente ──
    { id: "boll", kind: "plugin", defaultOn: false, available: function (s) { return s.hist && s.hist.length >= 20; }, label: function (c) { return "Bollinger (20,2)"; },
      compute: function (hist) { return rpSMAband(hist, 20, 2); },
      draw: function (g, c) {
        var poly = function (arr, st, w, dash) { var p = []; for (var i = 0; i < arr.length; i++) if (arr[i] != null) p.push(g.X(i).toFixed(1) + "," + g.Y(arr[i]).toFixed(1)); return p.length > 1 ? '<polyline points="' + p.join(" ") + '" fill="none" stroke="' + st + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' opacity="0.6"/>' : ''; };
        return poly(c.up, "var(--_cool)", 0.7, "3 2") + poly(c.lo, "var(--_cool)", 0.7, "3 2") + poly(c.mid, "var(--_dim)", 0.55, "1 2");
      } },
  ];

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".rp{--_bg:var(--rp-bg,#faf9f6);--_card:var(--rp-card,#ffffff);--_card2:var(--rp-card2,#f3f1ec);" +
      "--_line:var(--rp-line,#e6e3dc);--_txt:var(--rp-txt,#1a1a2e);--_dim:var(--rp-dim,#6e6e78);" +
      "--_accent:var(--rp-accent,#a8651a);--_hot:var(--rp-hot,#b02e22);--_warm:var(--rp-warm,#7a3b0e);--_cool:var(--rp-cool,#1a3a5c);--_neu:var(--rp-neu,#9c9c96);" +
      "--_font:var(--rp-font,'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif);--_mono:var(--rp-mono,'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace);" +
      // ganchos de tema p/ embeds premium (briefing editorial): número (peso/fonte), espaçamento, pílula, borda do card
      "--_numw:var(--rp-number-weight,700);--_numf:var(--rp-number-font,inherit);--_space:var(--rp-space,1);--_chip:var(--rp-chip-bg,var(--_card2));--_cardb:var(--rp-card-border,var(--_line));" +
      "background:var(--_bg);color:var(--_txt);font-family:var(--_font);border:1px solid var(--_line);border-radius:var(--rp-radius,14px);padding:22px;line-height:1.5;max-width:var(--rp-max,880px);margin:0 auto}" +
      ".rp *{box-sizing:border-box}" +
      ".rp h4{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--_dim);margin:16px 0 7px;font-weight:600}" +
      ".rp .g3{display:grid;grid-template-columns:repeat(auto-fit,minmax(116px,1fr));gap:8px}" +
      ".rp .c{background:var(--_card);border:1px solid var(--_cardb);border-radius:9px;padding:11px}" +
      ".rp .c .k{font-size:10.5px;color:var(--_dim)}.rp .c .b{font-size:20px;font-weight:var(--_numw);font-family:var(--_numf);margin-top:2px}.rp .c .r{font-size:10.5px;color:var(--_dim);margin-top:2px}" +
      ".rp .valstrip{margin-top:8px;background:var(--_card);border:1px solid var(--_line);border-left:3px solid var(--gold,#c8a24a);border-radius:9px;padding:10px 12px;cursor:pointer;transition:border-color .15s}" +
      ".rp .valstrip:hover{border-color:var(--gold,#c8a24a)}" +
      ".rp .valstrip .vl-l{display:flex;justify-content:space-between;align-items:baseline;gap:8px}" +
      ".rp .valstrip .vl-t{font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--gold,#c8a24a)}" +
      ".rp .valstrip .vl-r{font-size:10.5px;color:var(--_dim)}" +
      ".rp .valstrip .vl-b{margin-top:3px}.rp .valstrip .vl-s{font-size:19px;font-weight:var(--_numw);font-family:var(--_numf)}.rp .valstrip .vl-x{font-size:10.5px;color:var(--_dim)}" +
      // ── data-skin="editorial": preset "quiet luxury" opt-in (hairlines, números leves, paleta contida, mais ar) ──
      // Nosso default (marca Radar Perene) fica intacto; embeds premium ativam com data-skin="editorial".
      ".rp.skin-editorial{--rp-radius:2px;--_numw:540;--_numf:Georgia,'Times New Roman',serif;--_chip:transparent;--_card:transparent;--_cardb:transparent;padding:30px}" +
      ".rp.skin-editorial h4{margin:26px 0 10px;letter-spacing:.16em}" +
      ".rp.skin-editorial .g3{gap:1px;background:var(--_line)}" +  // filetes de 1px entre cards (a grade vira hairline)
      ".rp.skin-editorial .c{border:0;border-radius:0;background:var(--_bg);padding:14px 16px}" +
      ".rp.skin-editorial .c .b{font-size:23px;letter-spacing:-.01em}" +
      ".rp.skin-editorial .t{border-radius:0;border:0;border-left:2px solid var(--_neu);background:transparent;border-bottom:1px solid var(--_line);padding:11px 4px 11px 12px}" +
      ".rp.skin-editorial .chip{border:0;border-radius:0;background:transparent;padding:4px 14px 4px 0;margin:0 2px 4px 0;border-right:1px solid var(--_line)}" +
      ".rp.skin-editorial .tk .i{border-radius:0;background:transparent;border:0;border-bottom:1px solid var(--_line);padding:6px 10px 6px 0}" +
      ".rp.skin-editorial .valstrip{border-radius:0;border:0;border-left:2px solid var(--gold,#c8a24a);background:transparent;padding:12px 4px 12px 14px}" +
      ".rp.skin-editorial .sub{letter-spacing:.02em}" +
      ".rp .t{background:var(--_card2);border:1px solid var(--_line);border-left:3px solid var(--_neu);border-radius:8px;padding:9px}" +
      ".rp .t.hot{border-left-color:var(--_hot)}.rp .t.warm{border-left-color:var(--_warm)}.rp .t.cool{border-left-color:var(--_cool)}" +
      ".rp .t .n{font-size:11.5px;font-weight:600}.rp .t .v{font-size:17px;font-weight:var(--_numw);font-family:var(--_numf)}.rp .t .rr{font-size:10px;color:var(--_dim)}" +
      ".rp .chip{display:inline-flex;gap:5px;background:var(--_chip);border:1px solid var(--_line);border-radius:999px;padding:4px 10px;font-size:12px;margin:0 5px 6px 0}.rp .chip b{font-weight:var(--_numw)}.rp .chip .u{color:var(--_dim);font-size:10px}" +
      ".rp .hl{background:var(--_card2);border:1px solid var(--_accent);border-radius:11px;padding:15px}.rp .hl .q{font-size:12.5px;color:var(--_dim);margin-bottom:8px}.rp .hl .v{font-size:24px;font-weight:800;color:var(--_accent)}.rp .stat{display:flex;gap:18px;flex-wrap:wrap}.rp .stat .r{font-size:11px;color:var(--_dim)}" +
      ".rp ul.dv{margin:6px 0 0;padding:0;list-style:none}.rp ul.dv li{font-size:12px;padding:5px 0;border-top:1px solid var(--_line)}.rp ul.dv b{color:var(--_accent)}" +
      ".rp .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}.rp .sub{font-size:11px;color:var(--_dim)}" +
      ".rp .brand{display:inline-flex;align-items:center;gap:7px;text-decoration:none;color:var(--_txt);font-size:14px;font-weight:600;opacity:.92}.rp .brand b{color:var(--_accent);font-weight:700}.rp .brand svg{flex:none;opacity:.9}" +
      ".rp .ft{margin-top:14px;font-size:10px;color:var(--_dim);text-align:center}.rp .ft a{color:var(--_accent);text-decoration:none}" +
      ".rp .bar{height:5px;border-radius:3px;background:var(--_line);margin-top:6px;overflow:hidden}.rp .bar i{display:block;height:100%;border-radius:3px;background:var(--_neu)}" +
      ".rp .t.hot .bar i{background:var(--_hot)}.rp .t.warm .bar i{background:var(--_warm)}.rp .t.cool .bar i{background:var(--_cool)}" +
      ".rp .legend{font-size:10.5px;color:var(--_dim);margin:2px 0 4px}" +
      ".rp .teaser{margin-top:16px;background:var(--_card2);border:1px dashed var(--_accent);border-radius:10px;padding:13px 15px;font-size:13px;color:var(--_txt)}.rp .teaser b{color:var(--_accent)}.rp .teaser a{display:inline-block;margin-top:6px;color:var(--_accent);text-decoration:none;font-weight:700}" +
      ".rp .brain{display:flex;align-items:baseline;gap:8px;margin:20px 0 2px;padding-top:15px;border-top:1px solid var(--_line)}" +
      ".rp .brain.first{border-top:0;padding-top:2px;margin-top:6px}.rp .brain .bn{font-size:13px;font-weight:700;letter-spacing:.02em}.rp .brain .bt{font-size:10.5px;color:var(--_dim)}" +
      ".rp .brain .bx{margin-left:auto;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--_accent);border:1px solid var(--_accent);border-radius:999px;padding:1px 7px}" +
      ".rp .lns{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:7px}" +
      ".rp .ln{background:var(--_card2);border:1px solid var(--_line);border-left:3px solid var(--_neu);border-radius:8px;padding:9px}" +
      ".rp .ln.hot{border-left-color:var(--_hot);background:linear-gradient(160deg,color-mix(in srgb,var(--_hot) 7%,var(--_card2)),var(--_card2) 72%)}.rp .ln.warm{border-left-color:var(--_warm);background:linear-gradient(160deg,color-mix(in srgb,var(--_warm) 7%,var(--_card2)),var(--_card2) 72%)}.rp .ln.cool{border-left-color:var(--_cool);background:linear-gradient(160deg,color-mix(in srgb,var(--_cool) 7%,var(--_card2)),var(--_card2) 72%)}" +
      ".rp .ln .lk{font-size:11.5px;font-weight:700}.rp .ln .li{font-size:9.5px;color:var(--_dim);margin:2px 0 5px;line-height:1.25;min-height:23px}.rp .ln .lv{font-size:14px;font-weight:700}.rp .ln .lr{font-size:9.5px;color:var(--_dim)}" +
      ".rp ul.ll{margin:6px 0 0;padding:0;list-style:none}.rp ul.ll li{font-size:11.5px;padding:6px 0;border-top:1px solid var(--_line);color:var(--_txt)}.rp ul.ll .tag{color:var(--_dim);font-size:9.5px}" +
      ".rp .tk{display:flex;flex-wrap:wrap;gap:6px}.rp .tk .i{background:var(--_card2);border:1px solid var(--_line);border-radius:7px;padding:5px 9px;font-size:11.5px;display:inline-flex;gap:6px;align-items:baseline}" +
      ".rp .tk .i .sy{font-weight:700}.rp .tk .i .pr{color:var(--_txt)}.rp .tk .i .mt{color:var(--_dim);font-size:9.5px}" +
      ".rp .live{display:flex;align-items:center;gap:7px;font-size:10.5px;color:var(--_dim);margin:0 0 6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.rp .live .dot{width:7px;height:7px;border-radius:50%;background:var(--_accent);flex:none}" +
      ".rp .spk{display:block;width:100%;height:26px;margin-top:7px}" +
      ".rp .comp{display:flex;width:100%;height:15px;border-radius:4px;overflow:hidden;border:1px solid var(--_line);margin:3px 0 4px}.rp .seg{height:100%}.rp .seg.hot{background:var(--_hot)}.rp .seg.warm{background:var(--_warm)}.rp .seg.cool{background:var(--_cool)}.rp .seg.neu{background:var(--_dim)}" +
      ".rp .rp-imxp{display:inline-block;margin-top:7px;font-family:var(--_mono);font-size:9.5px;background:var(--_card2);border:1px solid var(--_accent);color:var(--_accent);border-radius:5px;padding:3px 10px;cursor:pointer}.rp .rp-imxp:hover{background:var(--_accent);color:#fff}" +
      ".rp .bc{display:block;width:100%;height:54px;margin-top:5px;background:var(--_card2);border:1px solid var(--_line);border-radius:6px}.rp .bcx{display:block;font-family:var(--_mono);font-size:9.5px;color:var(--_dim);margin-top:2px}.rp .bcx b{color:var(--_accent)}.rp .bcx .pj{color:var(--_warm)}" +
      ".rp .mg{display:block;margin-top:4px}.rp .mg .nd{animation:rpbreath 3.4s ease-in-out infinite}@keyframes rpbreath{0%,100%{opacity:.45}50%{opacity:1}}@media(prefers-reduced-motion:reduce){.rp .mg .nd{animation:none;opacity:.9}}" +
      ".rp .b,.rp .v,.rp .lv,.rp .vv,.rp .hl .v,.rp .tk .i .pr,.rp .live{font-family:var(--_mono);font-feature-settings:'tnum'}" +
      ".rp .tk .i[data-cod]{cursor:pointer}.rp .tk .i[data-cod]:hover{border-color:var(--_accent)}" +
      ".rp [data-exp]{cursor:pointer}.rp .more{display:none;margin-top:6px;border-top:1px solid var(--_line);padding-top:5px}.rp .open .more{display:block}.rp .more .mi{font-size:10px;color:var(--_dim);padding:2px 0}" +
      ".rp .rp-zoom{margin-top:6px;border:1px solid var(--_line);background:var(--_card2);color:var(--_accent);border-radius:7px;font-size:10px;padding:3px 9px;cursor:pointer;font-family:var(--rp-font,'Inter',system-ui,sans-serif)}.rp .rp-zoom:hover{border-color:var(--_accent)}" +
      // seletor de horizonte do Ânima: estrutural (252d, free) ↔ curto (63d, Founder 🔒) — vive no painel empilhado e re-monta o oscilador
      ".rp .rp-asel{font-family:var(--_mono);font-size:9.5px;border-radius:6px;padding:2px 9px;cursor:pointer;background:var(--_card2);border:1px solid var(--_line);color:var(--_dim)}" +
      ".rp .rp-asel.on{background:var(--_accent);border-color:var(--_accent);color:var(--_card)}" +
      ".rp .rp-asel.lock{background:transparent;border:1px dashed var(--_line);color:var(--_dim);opacity:.85}.rp .rp-asel.lock:hover{border-color:var(--_accent);opacity:1}" +
      ".rp .rp-asel-up a{color:var(--_accent);text-decoration:none;font-weight:700}" +
      ".rp-mw{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,10,14,.55)}" +
      ".rp-mc{position:relative;max-width:560px!important;width:100%;max-height:88vh;overflow:auto;padding:20px 20px 16px!important;box-shadow:0 18px 60px rgba(0,0,0,.4);cursor:default}" +
      ".rp-mc .rp-x{position:absolute;top:9px;right:12px;border:0;background:transparent;color:var(--_dim);font-size:23px;line-height:1;cursor:pointer;padding:2px 6px}.rp-mc .rp-x:hover{color:var(--_accent)}" +
      ".rp-mc .rp-mt{font-weight:700;font-size:15px;margin:0 28px 2px 0}.rp-mc .rp-ml{font-size:10.5px;color:var(--_dim);margin:5px 0 0;line-height:1.4}.rp-mc .bc.big{height:150px}@media(max-width:600px){.rp-mw{padding:5px}.rp-mc{padding:13px 13px 12px!important;max-height:94vh}.rp-mc .rp-mt{font-size:13.5px;margin-right:26px}.rp-mc .rp-ml{font-size:9.8px;margin-top:4px}.rp-mc .bc.big{height:124px}.rp-mc .rp-per{gap:4px}}" +
      ".rp-mc .rp-strip{display:flex;gap:12px;flex-wrap:wrap;margin-top:3px}.rp-mc .rp-st{display:flex;flex-direction:column;font-family:var(--rp-mono,ui-monospace,monospace)}.rp-mc .rp-st b{font-size:13px;line-height:1.1}.rp-mc .rp-st span{font-size:9px;color:var(--_dim)}" +
      ".rp-mc .rp-52{position:relative;height:6px;background:var(--_card2);border:1px solid var(--_line);border-radius:4px;margin-top:4px}.rp-mc .rp-52 i{position:absolute;top:-2px;width:3px;height:10px;background:var(--_accent);border-radius:2px;transform:translateX(-50%)}" +
      ".rp-mc .rp-per{display:flex;gap:5px;margin:7px 0 3px;flex-wrap:wrap}.rp-mc .rp-per button{border:1px solid var(--_line);background:var(--_card2);color:var(--_dim);border-radius:6px;font-size:10px;padding:3px 10px;cursor:pointer;font-family:var(--rp-font,'Inter',system-ui,sans-serif)}.rp-mc .rp-per button.on{border-color:var(--_accent);color:var(--_accent)}.rp-mc .rp-per button.lock{color:var(--_accent);font-weight:600}" +
      ".rp-mc .rp-lock{border:1px dashed var(--_accent);border-radius:10px;padding:18px 16px;text-align:center;background:var(--_card2);min-height:120px;display:flex;flex-direction:column;justify-content:center}.rp-mc .rp-lock b{display:block;font-size:13px;margin-bottom:5px;color:var(--_txt)}.rp-mc .rp-lock small{font-size:10.5px;color:var(--_dim);line-height:1.5}.rp-mc .rp-lock .cta{display:inline-block;margin-top:11px;background:var(--_accent);color:#fff;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;text-decoration:none}.rp-mc .rp-lock .rp-anchor{display:block;margin-top:9px;font-size:10.5px;font-style:normal;color:var(--_warm);opacity:.92}.rp-mc .rp-gate{position:relative}.rp-mc .rp-gate .rp-blur{filter:blur(7px) saturate(.6);opacity:.5;pointer-events:none;user-select:none}.rp-mc .rp-gate .rp-lock{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:90%;width:340px;box-shadow:0 10px 34px rgba(0,0,0,.45)}" +
      ".rp-mc .rp-chart{position:relative}.rp-mc .rp-xh{position:absolute;top:0;bottom:16px;width:1px;background:var(--_accent);opacity:.55;pointer-events:none;transform:translateX(-0.5px)}.rp-mc .rp-xt{position:absolute;top:0;transform:translateX(-50%);background:var(--_accent);color:#fff;font-size:9px;font-family:var(--rp-mono,ui-monospace,monospace);padding:1px 5px;border-radius:3px;pointer-events:none;white-space:nowrap}.rp-mc .rp-yax{position:absolute;top:0;left:0;right:0;bottom:16px;pointer-events:none}.rp-mc .rp-yl{position:absolute;right:3px;transform:translateY(-50%);font-family:var(--_mono);font-size:9.5px;font-weight:600;color:var(--_txt);background:var(--_card2);padding:0 3px;border-radius:2px;opacity:.95;letter-spacing:-.2px;font-feature-settings:'tnum';box-shadow:0 0 0 1px var(--_line)}.rp-mc .rp-bsel{position:absolute;top:0;bottom:16px;background:var(--_accent);opacity:.14;pointer-events:none;border-left:1px solid var(--_accent);border-right:1px solid var(--_accent)}.rp-mc .rp-reset{margin-top:6px;font-family:var(--_mono);font-size:10px;background:var(--_card2);border:1px solid var(--_line);color:var(--_dim);border-radius:5px;padding:3px 9px;cursor:pointer}" +
      "@media(max-width:520px){.rp{padding:15px}.rp h4{margin:13px 0 6px}.rp .brain{margin-top:16px}}";
    document.head.appendChild(s);
  }

  function esc(x) { return String(x == null ? "" : x).replace(/[<>&]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]; }); }
  function cls(v) { return v == null ? "" : v >= 75 ? "hot" : v >= 55 ? "warm" : v <= 45 ? "cool" : ""; }
  function clz(z) { return z >= 2 ? "hot" : z >= 1 ? "warm" : z <= -1 ? "cool" : ""; }
  // sparkline tríade: histórico sólido → "hoje" (hairline) → projeção linear tracejada/fraca (P7: não é previsão)
  function spark(s) {
    if (!s || !s.hist || s.hist.length < 2) return "";
    var hist = s.hist, proj = s.proj || [], all = hist.concat(proj.length ? proj.slice(1) : []);
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), rng = (mx - mn) || 1, W = 130, H = 26, tot = all.length - 1 || 1;
    function X(i) { return (i / tot) * W; } function Y(val) { return (H - 3) - ((val - mn) / rng) * (H - 6); }
    var hp = hist.map(function (vv, i) { return X(i).toFixed(1) + "," + Y(vv).toFixed(1); }).join(" ");
    var out = '<svg class="spk" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">';
    out += '<polygon points="' + hp + ' ' + X(hist.length - 1).toFixed(1) + ',' + H + ' ' + X(0).toFixed(1) + ',' + H + '" fill="var(--_accent)" opacity="0.09" stroke="none"/>';  // área sob a linha (profundidade, consistente com bigChart)
    out += '<polyline points="' + hp + '" fill="none" stroke="var(--_accent)" stroke-width="1.4"/>';
    if (proj.length > 1) { var nx = X(hist.length - 1);
      var pp = proj.map(function (vv, i) { return X(hist.length - 1 + i).toFixed(1) + "," + Y(vv).toFixed(1); }).join(" ");
      out += '<line x1="' + nx.toFixed(1) + '" y1="2" x2="' + nx.toFixed(1) + '" y2="' + (H - 2) + '" stroke="var(--_dim)" stroke-width="0.7" stroke-dasharray="1 2" opacity="0.6"/>';
      out += '<polyline points="' + pp + '" fill="none" stroke="var(--_accent)" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.5"/>'; }
    return out + '</svg>';
  }
  // mini-grafo de propagação entre lentes (única animação aprovada: "respiração" sutil; respeita prefers-reduced-motion)
  function propGraph(lentes) {
    if (!lentes || lentes.length < 5) return "";
    var cx = 150, cy = 80, R = 58, W = 300, H = 168, col = { hot: "var(--_hot)", warm: "var(--_warm)", cool: "var(--_cool)", neu: "var(--_neu)" };
    var pos = lentes.slice(0, 5).map(function (l, i) { var a = (-90 + i * 72) * Math.PI / 180; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), l: l }; });
    var edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [2, 0], [2, 4]], svg = '<svg class="mg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">';
    edges.forEach(function (e) { var a = pos[e[0]], b = pos[e[1]]; svg += '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" stroke="var(--_line)" stroke-width="1"/>'; });
    pos.forEach(function (p, i) { var c = col[p.l.tom] || "var(--_neu)", an = p.x < cx - 5 ? "end" : p.x > cx + 5 ? "start" : "middle", dx = an === "end" ? -9 : an === "start" ? 9 : 0, dy = p.y < cy ? -9 : 14;
      svg += '<circle class="nd" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="6" fill="' + c + '" style="animation-delay:' + (i * 0.5).toFixed(1) + 's"/>';
      svg += '<text x="' + (p.x + dx).toFixed(1) + '" y="' + (p.y + dy).toFixed(1) + '" text-anchor="' + an + '" fill="var(--_dim)" font-size="9">' + esc(p.l.nome) + '</text>'; });
    return svg + '</svg>';
  }
  // par curado: duas séries normalizadas [0,100] sobrepostas (gostinho do cruzamento livre)
  function dualSpark(a, b, c) {
    if (!a || !b || a.length < 2) return "";
    var W = 280, H = 44, n = a.length - 1 || 1;
    function pts(arr) { return arr.map(function (v, i) { return ((i / n) * W).toFixed(1) + "," + ((H - 3) - (v / 100) * (H - 6)).toFixed(1); }).join(" "); }
    var s = '<svg class="spk" width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">';
    for (var dg = 1; dg < 4; dg++) { var dy = ((H - 3) - (dg / 4) * (H - 6)).toFixed(1); s += '<line x1="0" y1="' + dy + '" x2="' + W + '" y2="' + dy + '" stroke="var(--_line)" stroke-width="0.3" opacity="0.4"/>'; }
    s += '<polyline points="' + pts(a) + '" fill="none" stroke="var(--_accent)" stroke-width="1.4"/><polyline points="' + pts(b) + '" fill="none" stroke="var(--_cool)" stroke-width="1.4"/>';
    if (c && c.length) s += '<polyline points="' + pts(c) + '" fill="none" stroke="var(--_warm)" stroke-width="2" stroke-dasharray="5 2"/>'; // razão = rotação risk-on/off
    return s + '</svg>';
  }
  // P1: índices/preços na casa do milhar com SEPARADOR de milhar (locale do usuário) em vez de "k" impreciso (3865→"3.865", não "3.9k"). M/B só p/ volume/market-cap gigante.
  function fmtNum(v) { if (v == null || !isFinite(v)) return "—"; var a = Math.abs(v); if (a >= 1e9) return (Math.round(v / 1e8) / 10) + "B"; if (a >= 1e6) return (Math.round(v / 1e5) / 10) + "M"; try { return v.toLocaleString(undefined, { maximumFractionDigits: 2 }); } catch (e) { return String(Math.round(v * 100) / 100); } }
  // gráfico "de verdade" (parâmetros): faixa min/máx, "hoje", projeção tracejada destacada, último valor rotulado
  function bigChart(s, opt) {
    if (!s || !s.hist || s.hist.length < 2) return "";
    opt = opt || {}; var big = !!opt.big, pro = !!opt.pro;  // pro=assinante: vê o cone completo; free vê só a mediana (gancho)
    var hist = s.hist;
    var cone = (s.cone && s.cone.mid && s.cone.mid.length > 1) ? s.cone : null;       // cone de quantis (assimétrico, estilo Cowen)
    var proj = (!cone && s.proj && s.proj.length > 1) ? s.proj : [];                   // fallback: projeção linear
    var futN = cone ? (cone.mid.length - 1) : (proj.length ? proj.length - 1 : 0);
    var all = hist.slice();
    if (cone) { if (pro) all = all.concat((cone.lo2 || cone.lo).slice(1), (cone.hi2 || cone.hi).slice(1)); else all = all.concat(cone.mid.slice(1)); }  // free: range só até a mediana (sem espaço morto da banda); pro: até p10–p90
    else if (proj.length) all = all.concat(proj.slice(1));
    if (opt.fair && opt.fair.length) all = all.concat(opt.fair.filter(function (v) { return v != null; }));  // FASTgraphs: a faixa de valor-justo entra no range
    if (opt.shadow && opt.shadow.lo) all = all.concat(opt.shadow.lo.filter(function (v) { return v != null; }), opt.shadow.hi.filter(function (v) { return v != null; }));  // sombra (cone no passado)
    if (opt.ma200) all = all.concat(opt.ma200.filter(function (v) { return v != null; }));
    if (opt.ma50) all = all.concat(opt.ma50.filter(function (v) { return v != null; }));
    // plugins computados UMA vez, ANTES do range → bandas (Bollinger etc.) entram no mín/máx (sem clipping)
    var _plug = [];
    if (opt.plugins && opt.plugins.length) for (var _pi = 0; _pi < opt.plugins.length; _pi++) { try { var _pl = opt.plugins[_pi], _pc = _pl.compute(hist); if (_pc) { _plug.push({ d: _pl, c: _pc }); for (var _k in _pc) if (_pc[_k] && _pc[_k].length) all = all.concat(_pc[_k].filter(function (v) { return v != null && isFinite(v); })); } } catch (_e) { } }
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), rng = (mx - mn) || 1;
    var W = 280, H = big ? 120 : 60, pL = 3, pR = 4, pT = 6, pB = 6, pw = W - pL - pR, ph = H - pT - pB, tot = (hist.length - 1 + futN) || 1;
    function X(i) { return pL + (i / tot) * pw; } function Y(v) { return pT + (1 - (v - mn) / rng) * ph; }
    var bi = hist.length - 1, nx = X(bi);
    function path(arr, base) { return arr.map(function (v, i) { return X(base + i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" "); }
    var o = '<svg class="bc' + (big ? ' big' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" aria-hidden="true">';
    o += '<defs><linearGradient id="rpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--_accent)" stop-opacity="0.2"/><stop offset="1" stop-color="var(--_accent)" stop-opacity="0"/></linearGradient></defs>';  // gradiente sob o preço (profundidade, grau-TradingView)
    o += '<line x1="' + pL + '" y1="' + Y(mx).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(mx).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.6"/>';
    o += '<line x1="' + pL + '" y1="' + Y(mn).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(mn).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.6"/>';
    // grid de terminal (Bloomberg): horizontais intermediárias + verticais faint — escalam limpo (sem texto SVG, que distorce)
    for (var gi = 1; gi < 4; gi++) { var gy = (pT + (gi / 4) * ph).toFixed(1); o += '<line x1="' + pL + '" y1="' + gy + '" x2="' + (W - pR) + '" y2="' + gy + '" stroke="var(--_line)" stroke-width="0.35" opacity="0.5"/>'; }
    for (var gj = 1; gj < 6; gj++) { var gx = (pL + (gj / 6) * pw).toFixed(1); o += '<line x1="' + gx + '" y1="' + pT + '" x2="' + gx + '" y2="' + (H - pB) + '" stroke="var(--_line)" stroke-width="0.35" opacity="0.32"/>'; }
    if (s.bands && s.bands.length) { // banding de regime (terminal): faixa de fundo sutil por regime BR
      for (var bd = 0; bd < s.bands.length; bd++) { var b = s.bands[bd], bx0 = X(b.i0), bx1 = X(Math.min(hist.length - 1, (b.i1 || b.i0) + 1));
        o += '<rect x="' + bx0.toFixed(1) + '" y="' + pT + '" width="' + Math.max(0, bx1 - bx0).toFixed(1) + '" height="' + ph.toFixed(1) + '" fill="var(--_' + (b.tom || 'neu') + ')" opacity="0.06"/>'; } }
    if (opt.shadow && opt.shadow.lo && pro && opt.cone !== false) { // SOMBRA: a MESMA distribuição do cone aplicada ao passado → preenche o gráfico (passado×presente×futuro)
      var shHP = [], shLR = [];
      for (var shi = 0; shi < hist.length; shi++) { if (opt.shadow.hi[shi] != null) shHP.push(X(shi).toFixed(1) + "," + Y(opt.shadow.hi[shi]).toFixed(1)); }
      for (var shj = hist.length - 1; shj >= 0; shj--) { if (opt.shadow.lo[shj] != null) shLR.push(X(shj).toFixed(1) + "," + Y(opt.shadow.lo[shj]).toFixed(1)); }
      if (shHP.length > 1) o += '<polygon points="' + shHP.concat(shLR).join(" ") + '" fill="var(--_warm)" opacity="0.11" stroke="var(--_warm)" stroke-width="0.4" stroke-opacity="0.3"/>';  // sombra do passado mais visível
    }
    if (cone && pro && opt.cone !== false) { // cone assimétrico (estilo Cowen) — SÓ assinante; free vê só a mediana; toggle via opt.cone
      if (cone.lo2 && cone.hi2) { // banda externa p10–p90 (mais clara), desenhada atrás da p25–p75
        var hi2Pts = cone.hi2.map(function (v, i) { return X(bi + i).toFixed(1) + "," + Y(v).toFixed(1); });
        var lo2Rev = cone.lo2.map(function (v, i) { return X(bi + i).toFixed(1) + "," + Y(v).toFixed(1); }).reverse();
        o += '<polygon points="' + hi2Pts.concat(lo2Rev).join(" ") + '" fill="var(--_warm)" opacity="0.07" stroke="none"/>';
      }
      var hiPts = cone.hi.map(function (v, i) { return X(bi + i).toFixed(1) + "," + Y(v).toFixed(1); });
      var loRev = cone.lo.map(function (v, i) { return X(bi + i).toFixed(1) + "," + Y(v).toFixed(1); }).reverse();
      o += '<polygon points="' + hiPts.concat(loRev).join(" ") + '" fill="var(--_warm)" opacity="0.13" stroke="none"/>';
      o += '<polyline points="' + path(cone.hi, bi) + '" fill="none" stroke="var(--_warm)" stroke-width="0.6" opacity="0.55"/>';
      o += '<polyline points="' + path(cone.lo, bi) + '" fill="none" stroke="var(--_warm)" stroke-width="0.6" opacity="0.55"/>';
    } else if (proj.length && big) {
      o += '<rect x="' + nx.toFixed(1) + '" y="' + pT + '" width="' + (W - pR - nx).toFixed(1) + '" height="' + ph.toFixed(1) + '" fill="var(--_warm)" opacity="0.07"/>';
    }
    // área preenchida sob o preço (corpo/profundidade do gráfico) — região histórica
    var histPts = hist.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); });
    o += '<polygon points="' + histPts.join(" ") + " " + X(bi).toFixed(1) + "," + (H - pB) + " " + X(0).toFixed(1) + "," + (H - pB) + '" fill="url(#rpg)" stroke="none"/>';
    o += '<polyline points="' + histPts.join(" ") + '" fill="none" stroke="var(--_accent)" stroke-width="' + (big ? 1.3 : 1.6) + '" stroke-linejoin="round"/>';
    var curY = Y(hist[hist.length - 1]).toFixed(1); o += '<line x1="' + pL + '" y1="' + curY + '" x2="' + (W - pR) + '" y2="' + curY + '" stroke="var(--_accent)" stroke-width="0.5" stroke-dasharray="2 3" opacity="0.4"/>';  // nível do preço atual (referência grau-TradingView)
    if (opt.ma200) { var mp2 = []; for (var ma2i = 0; ma2i < hist.length; ma2i++) { if (opt.ma200[ma2i] != null) mp2.push(X(ma2i).toFixed(1) + "," + Y(opt.ma200[ma2i]).toFixed(1)); } if (mp2.length > 1) o += '<polyline points="' + mp2.join(" ") + '" fill="none" stroke="var(--_cool)" stroke-width="' + (big ? 1 : 0.9) + '" opacity="0.78"/>'; }  // MM200
    if (opt.ma50) { var mp5 = []; for (var ma5i = 0; ma5i < hist.length; ma5i++) { if (opt.ma50[ma5i] != null) mp5.push(X(ma5i).toFixed(1) + "," + Y(opt.ma50[ma5i]).toFixed(1)); } if (mp5.length > 1) o += '<polyline points="' + mp5.join(" ") + '" fill="none" stroke="var(--_dim)" stroke-width="' + (big ? 0.9 : 0.8) + '" opacity="0.72" stroke-dasharray="2 1.5"/>'; }  // MM50
    if (opt.fair && opt.fair.length) {  // FASTgraphs: linha de valor-justo (EPS × P/E normal) — ancora no fundamento
      var fpts = []; for (var fi = 0; fi < opt.fair.length && fi < hist.length; fi++) { if (opt.fair[fi] != null) fpts.push(X(fi).toFixed(1) + "," + Y(opt.fair[fi]).toFixed(1)); }
      if (fpts.length > 1) o += '<polyline points="' + fpts.join(" ") + '" fill="none" stroke="var(--_warm)" stroke-width="' + (big ? 1.5 : 1.2) + '" stroke-dasharray="4 2" opacity="0.92"/>';
    }
    if (opt.futFair && opt.futFair.length && (cone || proj.length)) {  // valor-justo PROJETADO no futuro — âncora fundamental atravessa o cone de preço (bug 3)
      var ffp = [], lastF = null; for (var lf = (opt.fair ? opt.fair.length : 0) - 1; lf >= 0; lf--) { if (opt.fair && opt.fair[lf] != null) { lastF = opt.fair[lf]; break; } }
      if (lastF != null) ffp.push(X(bi).toFixed(1) + "," + Y(lastF).toFixed(1));  // conecta do último valor-justo histórico (hoje)
      for (var fk = 0; fk < opt.futFair.length && fk < futN; fk++) { if (opt.futFair[fk] != null) ffp.push(X(bi + 1 + fk).toFixed(1) + "," + Y(opt.futFair[fk]).toFixed(1)); }
      if (ffp.length > 1) o += '<polyline points="' + ffp.join(" ") + '" fill="none" stroke="var(--_warm)" stroke-width="' + (big ? 1.2 : 1) + '" stroke-dasharray="1 2.5" opacity="0.6"/>';
    }
    // ── camadas-PLUGIN (Strategy): cada indicador drop-in desenha aqui, no foreground (já computado p/ o range) ──
    for (var _di = 0; _di < _plug.length; _di++) { try { o += _plug[_di].d.draw({ X: X, Y: Y }, _plug[_di].c); } catch (_e) { /* plugin isolado: nunca derruba o gráfico */ } }
    if (cone || proj.length) o += '<line x1="' + nx.toFixed(1) + '" y1="' + pT + '" x2="' + nx.toFixed(1) + '" y2="' + (H - pB) + '" stroke="var(--_dim)" stroke-width="0.8" stroke-dasharray="1 2"/>';
    if (cone && opt.cone !== false) o += '<polyline points="' + path(cone.mid, bi) + '" fill="none" stroke="var(--_warm)" stroke-width="' + (big ? 1.4 : 1.6) + '" stroke-dasharray="4 2"/>';
    else if (proj.length) o += '<polyline points="' + path(proj, bi) + '" fill="none" stroke="var(--_warm)" stroke-width="' + (big ? 1.4 : 1.8) + '" stroke-dasharray="4 2"/>';
    var tail = cone ? (pro ? (' · <span class="pj">⤳ ' + esc(fmtNum(cone.lo[cone.lo.length - 1])) + '–' + esc(fmtNum(cone.hi[cone.hi.length - 1])) + '</span>') : (' · <span class="pj">⤳ ' + esc(fmtNum(cone.mid[cone.mid.length - 1])) + '</span>')) : (proj.length ? ' · <span class="pj">⤳ ' + esc(fmtNum(proj[proj.length - 1])) + '</span>' : '');
    return o + '</svg><span class="bcx"><b>' + esc(fmtNum(hist[hist.length - 1])) + '</b> · ↑' + esc(fmtNum(mx)) + ' · ↓' + esc(fmtNum(mn)) + tail + '</span>';
  }
  // scatter (Lead-Lag): cada ponto = um mês; X=score do regime, Y=retorno do IBOV em 6m. Didático: faixa "hoje" (cur±8)
  // destacada, pontos análogos em foco (resto esmaecido), mediana dos análogos e marcador de hoje. P7.
  function scatterChart(sc) {
    if (!sc || !sc.points || sc.points.length < 10) return "";
    var pts = sc.points, ys = pts.map(function (p) { return p.y; });
    var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys), yr = (ymax - ymin) || 1;
    var W = 280, H = 150, pL = 4, pR = 4, pT = 6, pB = 6, pw = W - pL - pR, ph = H - pT - pB;
    var cx = sc.cur_x, band = 8;
    function X(v) { return pL + (Math.max(0, Math.min(100, v)) / 100) * pw; }
    function Y(v) { return pT + (1 - (v - ymin) / yr) * ph; }
    var o = '<svg class="bc big" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" aria-hidden="true">';
    if (ymin < 0 && ymax > 0) { var y0 = Y(0);
      o += '<rect x="' + pL + '" y="' + pT + '" width="' + pw.toFixed(1) + '" height="' + Math.max(0, y0 - pT).toFixed(1) + '" fill="var(--_warm)" opacity="0.045"/>';
      o += '<rect x="' + pL + '" y="' + y0.toFixed(1) + '" width="' + pw.toFixed(1) + '" height="' + Math.max(0, (H - pB) - y0).toFixed(1) + '" fill="var(--_cool)" opacity="0.045"/>'; }
    // ★ faixa "regime de hoje" (cur±8): onde moram os análogos — o foco da leitura
    if (cx != null) o += '<rect x="' + X(cx - band).toFixed(1) + '" y="' + pT + '" width="' + (X(cx + band) - X(cx - band)).toFixed(1) + '" height="' + ph.toFixed(1) + '" fill="var(--_accent)" opacity="0.08"/>';
    for (var sgg = 1; sgg < 4; sgg++) { var sgy = (pT + (sgg / 4) * ph).toFixed(1); o += '<line x1="' + pL + '" y1="' + sgy + '" x2="' + (W - pR) + '" y2="' + sgy + '" stroke="var(--_line)" stroke-width="0.3" opacity="0.4"/>'; }
    if (ymin < 0 && ymax > 0) o += '<line x1="' + pL + '" y1="' + Y(0).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.6"/>';
    // pontos: análogos (dentro da faixa) em foco; resto esmaecido — o olho vai pro cluster que importa
    o += pts.map(function (p) { var near = cx != null && Math.abs(p.x - cx) <= band;
      return '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="' + (near ? 1.7 : 1.1) + '" fill="var(--_' + (p.y >= 0 ? "warm" : "cool") + ')" opacity="' + (near ? 0.9 : 0.22) + '"/>'; }).join("");
    // mediana dos análogos (faixa) + marcador "hoje"
    if (cx != null && sc.med_at_cur != null) {
      o += '<line x1="' + X(cx - band).toFixed(1) + '" y1="' + Y(sc.med_at_cur).toFixed(1) + '" x2="' + X(cx + band).toFixed(1) + '" y2="' + Y(sc.med_at_cur).toFixed(1) + '" stroke="var(--_accent)" stroke-width="1.1" stroke-dasharray="4 2"/>';
      o += '<circle cx="' + X(cx).toFixed(1) + '" cy="' + Y(sc.med_at_cur).toFixed(1) + '" r="3.2" fill="var(--_accent)"/>';
    }
    if (cx != null) o += '<line x1="' + X(cx).toFixed(1) + '" y1="' + pT + '" x2="' + X(cx).toFixed(1) + '" y2="' + (H - pB) + '" stroke="var(--_accent)" stroke-width="1" stroke-dasharray="2 2" opacity="0.7"/>';
    return o + '</svg>';
  }
  // distribuição dos desfechos análogos (histograma do IBOV +6m perto do regime de hoje) — "a maioria caiu entre X e Y"
  function distChart(sc) {
    if (!sc || !sc.points || sc.cur_x == null) return null;
    var near = sc.points.filter(function (p) { return Math.abs(p.x - sc.cur_x) <= 8; }).map(function (p) { return p.y; }).sort(function (a, b) { return a - b; });
    if (near.length < 8) return null;
    var lo = near[0], hi = near[near.length - 1], rng = (hi - lo) || 1;
    var q = function (f) { return near[Math.min(near.length - 1, Math.floor(f * near.length))]; };
    var p25 = q(0.25), p50 = near[Math.floor(near.length / 2)], p75 = q(0.75);
    var NB = 9, bins = new Array(NB).fill(0);
    near.forEach(function (y) { bins[Math.min(NB - 1, Math.floor((y - lo) / rng * NB))]++; });
    var bmax = Math.max.apply(null, bins) || 1;
    var W = 280, H = 150, pL = 4, pR = 4, pT = 8, pB = 8, pw = W - pL - pR, ph = H - pT - pB;
    var Xb = function (v) { return pL + ((v - lo) / rng) * pw; };
    var o = '<svg class="bc big" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" aria-hidden="true">';
    o += '<rect x="' + Xb(p25).toFixed(1) + '" y="' + pT + '" width="' + Math.max(0, Xb(p75) - Xb(p25)).toFixed(1) + '" height="' + ph.toFixed(1) + '" fill="var(--_accent)" opacity="0.08"/>';
    var bw = pw / NB;
    for (var i = 0; i < NB; i++) { var bh = (bins[i] / bmax) * ph, bx = pL + i * bw, mid = lo + (i + 0.5) / NB * rng;
      o += '<rect x="' + (bx + 0.6).toFixed(1) + '" y="' + (pT + ph - bh).toFixed(1) + '" width="' + (bw - 1.2).toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="var(--_' + (mid >= 0 ? "warm" : "cool") + ')" opacity="0.6"/>'; }
    if (lo < 0 && hi > 0) o += '<line x1="' + Xb(0).toFixed(1) + '" y1="' + pT + '" x2="' + Xb(0).toFixed(1) + '" y2="' + (H - pB) + '" stroke="var(--_line)" stroke-width="0.6"/>';
    o += '<line x1="' + Xb(p50).toFixed(1) + '" y1="' + (pT - 3) + '" x2="' + Xb(p50).toFixed(1) + '" y2="' + (H - pB) + '" stroke="var(--_accent)" stroke-width="1.3"/>';
    return { svg: o + '</svg>', p25: Math.round(p25 * 10) / 10, p50: Math.round(p50 * 10) / 10, p75: Math.round(p75 * 10) / 10, n: near.length };
  }
  // Risk-on/off (SentimenTrader, P7: SEM buy signal): oscilador 0-100 com threshold 50, zonas de extremo e MARCAÇÃO de alerta nos extremos passados
  function riskPane(rk, opt) {
    if (!rk || !rk.serie || rk.serie.length < 2) return "";
    opt = opt || {}; var big = !!opt.big;
    var s = rk.serie, n = s.length - 1 || 1, W = 280, H = big ? 70 : 40, pL = 3, pR = 4, pT = 4, pB = 4, pw = W - pL - pR, ph = H - pT - pB;
    function X(i) { return pL + (i / n) * pw; } function Y(v) { return pT + (1 - Math.max(0, Math.min(100, v)) / 100) * ph; }
    var o = '<svg class="bc' + (big ? ' big' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" aria-hidden="true">';
    o += '<rect x="' + pL + '" y="' + pT + '" width="' + pw.toFixed(1) + '" height="' + (Y(rk.hi) - pT).toFixed(1) + '" fill="var(--_hot)" opacity="0.06"/>';            // zona risco-off (defensivo)
    o += '<rect x="' + pL + '" y="' + Y(rk.lo).toFixed(1) + '" width="' + pw.toFixed(1) + '" height="' + ((H - pB) - Y(rk.lo)).toFixed(1) + '" fill="var(--_cool)" opacity="0.06"/>'; // zona risco-on
    o += '<line x1="' + pL + '" y1="' + Y(rk.hi).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(rk.hi).toFixed(1) + '" stroke="var(--_hot)" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.6"/>';
    o += '<line x1="' + pL + '" y1="' + Y(rk.lo).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(rk.lo).toFixed(1) + '" stroke="var(--_cool)" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.6"/>';
    o += '<line x1="' + pL + '" y1="' + Y(rk.thr).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(rk.thr).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.5"/>';
    var rpts = []; for (var ri = 0; ri < s.length; ri++) { if (s[ri] == null || !isFinite(s[ri])) continue; rpts.push(X(ri).toFixed(1) + "," + Y(s[ri]).toFixed(1)); }  // pula nulos (Ânima vazio antes da série começar) — sem ponto fantasma no rodapé
    o += '<polyline points="' + rpts.join(" ") + '" fill="none" stroke="var(--_accent)" stroke-width="' + (big ? 1.3 : 1.4) + '"/>';
    if (rk.marks) for (var mi = 0; mi < rk.marks.length; mi++) { var mk = rk.marks[mi], mx = X(mk.i); o += '<line x1="' + mx.toFixed(1) + '" y1="' + (H - pB - 3) + '" x2="' + mx.toFixed(1) + '" y2="' + (H - pB) + '" stroke="var(--_' + (mk.tom || 'neu') + ')" stroke-width="1.4"/>'; }  // marca de alerta (extremo), sem direção de trade
    return o + '</svg>';
  }

  // ── COMPONENTE UNIVERSAL DE ATIVO (uPlot): pilha SentimenTrader = preço · Ânima · Risk-on/off, sincronizados (crosshair + janela). ──
  // Monta os 2 osciladores GLOBAIS (Ânima=humor, Risk=regime) sob o preço, no MESMO grupo de sync → passar o cursor no preço acende o
  // sentimento daquele dia nos outros dois. axisW fixo casa as calhas-Y → o crosshair alinha na vertical. hideX: datas só no painel de baixo.
  function mountStackOsc(animaEl, riskEl, s, syncKey, lang, big, animaObj, pro) {
    var hasRisk = !!(riskEl && s.risco && s.risco.serie && s.risco.serie.length > 1);
    mountOsc(animaEl, animaObj || s.anima, s, syncKey, big, hasRisk, "anima", pro);  // Ânima = painel do meio → esconde o eixo-X se há risco abaixo
    if (hasRisk) mountOsc(riskEl, s.risco, s, syncKey, big, false, "risk", pro);     // risco = painel de baixo → mostra as datas
  }
  // monta UM oscilador empilhado (idempotente: upOscillator faz clear(el); re-monta no toggle de horizonte sem duplicar no re-tema).
  function mountOsc(el, obj, s, syncKey, big, hideX, role, pro) {
    if (!el || !obj || !obj.serie || obj.serie.length < 2) return;
    var o = { big: big, sync: syncKey, datas: s.datas, axisW: 52, nav: !!pro, hideX: hideX, height: (big ? 112 : 48), sinais: s.sinais, role: role };  // nav só p/ Founder (free trava no período); role = anima/risk → tooltip consolidado do preço lê o valor de cada painel
    for (var i = _upMounted.length - 1; i >= 0; i--) if (_upMounted[i].el === el) _upMounted.splice(i, 1);  // descarta entrada antiga desse el (o re-tema redesenha só o atual)
    if (window.RPUplot.upOscillator(el, obj, o)) _upMounted.push({ el: el, draw: function (e) { window.RPUplot.upOscillator(e, obj, o); } });
  }
  // ── SELETOR DE HORIZONTE DO ÂNIMA: estrutural (252d, free) ↔ curto (63d, Founder 🔒) ──────────────
  // Resolve qual oscilador-de-humor o usuário pode ver agora. Free SEMPRE vê o estrutural (a leitura canônica);
  // o curto (mais ruidoso, tático) é lente do Founder. Nunca vaza o curto gated p/ o free (obj = null se só houver curto).
  function animaActive(s, mode, pro) {
    var estr = (s.anima_estrut && s.anima_estrut.serie && s.anima_estrut.serie.length > 1) ? s.anima_estrut : null;
    var curt = (s.anima && s.anima.serie && s.anima.serie.length > 1) ? s.anima : null;
    var canCurto = pro && !!curt;                                   // curto exige Founder
    var m = (mode === "curto" && canCurto) ? "curto" : "estr";      // free normaliza p/ estrutural
    var obj = (m === "curto") ? curt : (estr || (pro ? curt : null));  // free sem estrutural → sem painel (não expõe o curto gated)
    return { mode: m, obj: obj, estr: estr, curt: curt, canCurto: canCurto };
  }
  function checkoutURL(lang) { return window.RP_CHECKOUT || (lang === "en" ? "https://buy.stripe.com/cNi00idj40NZ91NgQTb3q03" : "https://buy.stripe.com/5kQ6oG3Iu40bem7asvb3q01"); }
  // leitura TEXTUAL de um indicador de domínio (cripto: Fear&Greed/TVL; ações: volume). Substitui o gráfico cru — a pilha
  // empilhada (preço·Ânima·risk) é o gráfico padrão de TODO ticker; o resto vira linha de texto (último valor + faixa).
  function oscTextLine(arr, label, lang) {
    if (!arr || !arr.length || !label) return "";
    var last = null, mn = Infinity, mx = -Infinity, ok = false;
    for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (v == null || !isFinite(v)) continue; ok = true; last = v; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (!ok) return "";
    var L = lang === "en";
    return '<div class="rp-ml" style="margin-top:7px"><b>' + esc(label) + '</b> ' + esc(fmtNum(last)) + (mx > mn ? ' <span style="opacity:.6">· ' + (L ? "range " : "faixa ") + esc(fmtNum(mn)) + '–' + esc(fmtNum(mx)) + '</span>' : '') + '</div>';
  }
  // legenda do Ânima já com o horizonte ativo ("Humor do mercado BR: … · estrutural (252d)")
  function animaCap(obj, lang, mode) {
    var L = lang === "en";
    return oscCaption(obj, lang, "anima") + (mode === "curto" ? (L ? " · short (63d)" : " · curto (63d)") : (L ? " · structural (252d)" : " · estrutural (252d)"));
  }
  // HTML do seletor (só aparece quando HÁ as duas séries — senão é painel único, sem botão). Devolve "" se não há escolha.
  function animaSelHTML(aSel, lang) {
    if (!aSel.estr || !aSel.curt) return "";
    var L = lang === "en";
    var btn = function (m, lab, on, lock) { return '<button type="button" class="rp-asel' + (on ? " on" : "") + (lock ? " lock" : "") + '" data-am="' + m + '" data-lbl="' + esc(lab) + '"' + (lock ? ' data-lock="1"' : '') + '>' + (lock ? "🔒 " : on ? "● " : "○ ") + esc(lab) + '</button>'; };
    return '<div class="rp-asel-row" style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:9px">'
      + '<span class="rp-ml" style="opacity:.7;margin-right:1px">' + (L ? "Mood" : "Ânima") + '</span>'
      + btn("estr", L ? "Structural" : "Estrutural", aSel.mode === "estr", false)
      + btn("curto", L ? "Short" : "Curto", aSel.mode === "curto", !aSel.canCurto)
      + (aSel.canCurto ? '' : '<span class="rp-asel-up rp-ml" style="display:none;flex-basis:100%;opacity:.92;margin-top:3px"><span style="color:var(--_accent)">🔒</span> ' + (L ? "Short-term mood (63d) is a Founder lens — " : "O humor curto (63d) é lente do Founder — ") + '<a href="' + checkoutURL(lang) + '" target="_blank" rel="noopener">' + (L ? "unlock →" : "destravar →") + '</a></span>')
      + '</div>';
  }
  // Liga o seletor: troca o horizonte → re-monta o oscilador (mesmo grupo de sync do preço) + atualiza legenda/botões.
  // Locked (free clicando "curto") → só revela a linha de upsell (não troca). scope = modal ou node /ativo.
  function wireAnima(scope, s, lang, pro, syncKey, big) {
    var sel = scope.querySelectorAll(".rp-asel[data-am]"); if (!sel.length) return;
    var animaEl = scope.querySelector(".rp-anima"), capEl = scope.querySelector(".rp-anima-cap");
    var hasRisk = !!(s.risco && s.risco.serie && s.risco.serie.length > 1);
    var mode = "estr";
    function refresh() {
      var act = animaActive(s, mode, pro); mode = act.mode;       // normaliza (free nunca fica em curto)
      mountOsc(animaEl, act.obj, s, syncKey, big, hasRisk, "anima", pro);        // re-monta com o horizonte escolhido (re-entra no sync)
      if (capEl) capEl.textContent = animaCap(act.obj, lang, mode);
      sel.forEach(function (b) { var on = (b.getAttribute("data-am") === mode), lock = !!b.getAttribute("data-lock"); b.className = "rp-asel" + (on ? " on" : "") + (lock ? " lock" : ""); b.textContent = (lock ? "🔒 " : on ? "● " : "○ ") + b.getAttribute("data-lbl"); });
    }
    sel.forEach(function (b) { b.addEventListener("click", function () {
      if (b.getAttribute("data-lock")) { var up = scope.querySelector(".rp-asel-up"); if (up) up.style.display = "block"; return; }  // free → upsell, sem trocar
      mode = b.getAttribute("data-am"); refresh();
    }); });
  }
  // gating do paywall na PRÓPRIA série: Free vê Preço + MM200 + Mediana análoga; Founder ganha valor-justo, sombra, MM50 (e p25–p90 dentro do upPrice).
  function gateSerie(s, pro) {
    if (pro) return s;
    var c = {}; for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) c[k] = s[k];
    c.fair = null; c.dcf = null; c.ma50 = null; c.shadow = null;  // cone mantido: upPrice(pro=false) desenha SÓ a mediana análoga (p25/p75/p10/p90 ficam gated lá dentro)
    return c;
  }
  // legenda de UMA frase (P4): "Regime BR: próximo de neutro · traços marcam extremos passados". Lê o último valor não-nulo.
  function oscCaption(rk, lang, kind) {
    var L = lang === "en", v = null;
    if (rk && rk.serie) for (var i = rk.serie.length - 1; i >= 0; i--) if (rk.serie[i] != null) { v = rk.serie[i]; break; }
    var pos = v == null ? "—" : v >= 70 ? (L ? "elevated" : "elevado") : v <= 30 ? (L ? "low" : "baixo") : Math.abs(v - 50) <= 8 ? (L ? "near neutral" : "próximo de neutro") : v > 50 ? (L ? "above neutral" : "acima do neutro") : (L ? "below neutral" : "abaixo do neutro");
    if (kind === "anima") return (L ? "Ânima Index · BR market mood: " : "Índice Ânima · humor do mercado BR: ") + pos + (L ? " · extremes = greed/fear" : " · extremos = ganância/medo");
    // ★ Índice de Risco Perene = nome DIDÁTICO do apetite ao risco (o investidor BR não conhece "risk-on/off") — marca própria
    return (L ? "Perene Risk Index · risk appetite: " : "Índice de Risco Perene · apetite ao risco: ") + pos + (L ? " · ticks mark past extremes" : " · traços marcam extremos passados");
  }
  // rótulo CURTO de estado (Camada 4 "Leitura rápida") a partir do último valor 0–100 de um índice (Ânima/Risco).
  function rkPos(rk, L) {
    var v = null; if (rk && rk.serie) for (var i = rk.serie.length - 1; i >= 0; i--) if (rk.serie[i] != null) { v = rk.serie[i]; break; }
    return v == null ? "—" : v >= 70 ? (L ? "elevated" : "elevado") : v <= 30 ? (L ? "low" : "baixo") : Math.abs(v - 50) <= 8 ? (L ? "near neutral" : "próximo de neutro") : v > 50 ? (L ? "above neutral" : "acima do neutro") : (L ? "below neutral" : "abaixo do neutro");
  }
  // barra de overlays (P2): Preço · MM200 · Mediana análoga (free) + P25–P75 · P10–P90 · Bollinger · Valor-justo (Founder, com 🔒). Clique → openBig.
  function overlayBar(s, lang, pro) {
    var L = lang === "en", chips = [{ on: true, lock: false, lbl: L ? "Price" : "Preço" }];
    if (s.ma200 && s.ma200.length) chips.push({ on: true, lock: false, lbl: "MM200" });
    if (s.cone) chips.push({ on: true, lock: false, lbl: L ? "Analog median" : "Mediana análoga" });
    if (s.cone && (s.cone.lo || s.cone.lo2)) { chips.push({ on: pro, lock: !pro, lbl: "P25–P75" }); chips.push({ on: pro, lock: !pro, lbl: "P10–P90" }); }
    chips.push({ on: false, lock: !pro, lbl: "Bollinger" });
    if (s.fair) chips.push({ on: pro, lock: !pro, lbl: "Valuation (Lyn Alden)" });
    return '<div class="rp-obar" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:7px">' + chips.map(function (c) {
      var st = c.lock ? "background:transparent;border:1px dashed var(--_line);color:var(--_dim);opacity:.85" : c.on ? "background:var(--_accent);border:1px solid var(--_accent);color:var(--_card)" : "background:var(--_card2);border:1px solid var(--_line);color:var(--_dim)";
      return '<button class="rp-ob" type="button" style="font-family:var(--_mono);font-size:10px;border-radius:6px;padding:3px 9px;cursor:pointer;' + st + '">' + (c.lock ? "🔒 " : c.on ? "● " : "○ ") + esc(c.lbl) + '</button>';
    }).join("") + '</div>';
  }
  // bloco-análogo NOBRE (P3): a taxa-base como resumo do ativo, não como gráfico solto. Free=3m; Founder=3/6/12m.
  function analogBlock(s, nm, lang, pro) {
    var br = s.base_rate; if (!br || !br.h) return "";
    var L = lang === "en", HS = pro ? ["3m", "6m", "12m"] : ["3m"];
    var sgn = function (x) { return (x == null || !isFinite(x)) ? "—" : (x >= 0 ? "+" : "") + (Math.round(x * 10) / 10) + "%"; };
    var rows = HS.map(function (hk) {
      var d = br.h[hk]; if (!d) return "";
      var lab = hk === "3m" ? (L ? "3 months" : "3 meses") : hk === "6m" ? (L ? "6 months" : "6 meses") : (L ? "12 months" : "12 meses");
      var thin = (d.n == null || d.n < 8);
      return '<div style="margin-top:' + (hk === "3m" ? 0 : 9) + 'px"><div class="rp-ml" style="opacity:.7">' + esc(nm) + ' — ' + (L ? "similar regimes in " : "regimes semelhantes em ") + esc(lab) + '</div>'
        + '<div style="font-family:var(--_mono);margin-top:2px;line-height:1.5">'
        + (d.hit != null ? '<b style="color:var(--_' + (d.hit >= 50 ? "warm" : "cool") + ')">' + (L ? "Rose in " : "Subiu em ") + Math.round(d.hit) + '%</b>' + (L ? " of cases" : " dos casos") : '')
        + (d.mediana != null ? ' · ' + (L ? "median " : "mediana ") + '<b>' + sgn(d.mediana) + '</b>' : '')
        + (d.p25 != null && d.p75 != null ? ' · ' + (L ? "range " : "faixa ") + sgn(d.p25) + ' ' + (L ? "to" : "a") + ' ' + sgn(d.p75) : '')
        + (d.n != null ? ' · <span style="opacity:.7">' + d.n.toLocaleString(L ? "en-US" : "pt-BR") + (L ? " analog cases" : " casos análogos") + (thin ? (L ? " (limited)" : " (limitada)") : "") + '</span>' : '')
        + '</div></div>';
    }).join("");
    return '<div class="rp-analog" style="margin-top:10px;border:1px solid var(--_line);border-radius:9px;padding:10px 12px;background:var(--_card2)">'
      + '<div class="rp-ml" style="font-weight:700;letter-spacing:.03em">' + (L ? "SIMILAR HISTORICAL CASES" : "CASOS HISTÓRICOS SEMELHANTES") + '</div>' + rows
      + (!pro ? '<div class="rp-ml" style="margin-top:8px;opacity:.85"><span style="color:var(--_accent)">🔒</span> ' + (L ? "6m & 12m horizons in Founder" : "horizontes 6m e 12m no Founder") + '</div>' : '')
      + '<div class="rp-ml" style="margin-top:5px;opacity:.6">' + (L ? "empirical distribution of past outcomes — never a forecast" : "distribuição empírica de desfechos passados — nunca previsão") + '</div></div>';
  }
  // modal "ampliar": gráfico grande (futuro realçado) + complementares + correlações — 3ª camada de profundidade
  // ★ ESTÚDIO — cruzar até 3 séries (qualquer classe) rebaseadas a 100, alinhadas por grade MENSAL (lida com diário×mensal) + correlação
  var CMP_COLORS = ["var(--_accent)", "var(--_cool)", "var(--_warm)"];
  function compareChart(list, lang, opt) {
    opt = opt || {}; var big = !!opt.big, L = lang === "en";
    var valid = list.filter(function (x) { return x && x.hist && x.hist.length > 2 && x.datas && x.datas.length === x.hist.length; });
    if (valid.length < 2) return null;
    var maps = valid.map(function (x) { var m = {}; for (var i = 0; i < x.hist.length; i++) { var d = (x.datas[i] || "").slice(0, 7); if (d && isFinite(x.hist[i])) m[d] = x.hist[i]; } return m; });
    var months = maps.map(function (m) { return Object.keys(m).sort(); });
    if (months.some(function (mm) { return !mm.length; })) return null;
    var lo = months.map(function (mm) { return mm[0]; }).reduce(function (a, b) { return a > b ? a : b; });
    var hi = months.map(function (mm) { return mm[mm.length - 1]; }).reduce(function (a, b) { return a < b ? a : b; });
    if (lo >= hi) return null;  // sem sobreposição temporal
    var gset = {}; months.forEach(function (mm) { mm.forEach(function (mo) { if (mo >= lo && mo <= hi) gset[mo] = 1; }); });
    var grid = Object.keys(gset).sort();
    if (grid.length < 3) return null;
    var ff = maps.map(function (m) { var mm = Object.keys(m).sort(), out = [], last = null, j = 0; for (var k = 0; k < grid.length; k++) { while (j < mm.length && mm[j] <= grid[k]) { last = m[mm[j]]; j++; } out.push(last); } return out; });
    var base0 = ff.map(function (sx) { for (var k = 0; k < sx.length; k++) if (sx[k] != null) return sx[k]; return null; });
    var reb = ff.map(function (sx, si) { return sx.map(function (v) { return (v != null && base0[si]) ? (v / base0[si]) * 100 : null; }); });
    var allv = reb.reduce(function (a, sx) { return a.concat(sx.filter(function (v) { return v != null; })); }, []);
    var mn = Math.min.apply(null, allv), mx = Math.max.apply(null, allv), rng = (mx - mn) || 1;
    var n = grid.length - 1 || 1, W = 280, H = big ? 130 : 60, pL = 3, pR = 26, pT = 6, pB = 6, pw = W - pL - pR, ph = H - pT - pB;
    function X(i) { return pL + (i / n) * pw; } function Y(v) { return pT + (1 - (v - mn) / rng) * ph; }
    var o = '<svg class="bc' + (big ? ' big' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" aria-hidden="true">';
    o += '<line x1="' + pL + '" y1="' + Y(100).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(100).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.5" stroke-dasharray="2 2"/>'; // base 100
    for (var gi = 1; gi < 4; gi++) { var gx = (pL + (gi / 4) * pw).toFixed(1); o += '<line x1="' + gx + '" y1="' + pT + '" x2="' + gx + '" y2="' + (H - pB) + '" stroke="var(--_line)" stroke-width="0.3" opacity="0.35"/>'; }
    reb.forEach(function (sx, si) { var pts = []; for (var k = 0; k < sx.length; k++) if (sx[k] != null) pts.push(X(k).toFixed(1) + "," + Y(sx[k]).toFixed(1)); if (pts.length > 1) o += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + CMP_COLORS[si % 3] + '" stroke-width="' + (big ? 1.4 : 1.5) + '"/>'; });
    o += '</svg>';
    // correlação pairwise (1ª diferença das séries rebaseadas)
    function corr(a, b) { var da = [], db = []; for (var k = 1; k < a.length; k++) { if (a[k] != null && a[k - 1] != null && b[k] != null && b[k - 1] != null) { da.push(a[k] - a[k - 1]); db.push(b[k] - b[k - 1]); } } if (da.length < 6) return null; var ma = da.reduce(function (x, y) { return x + y; }, 0) / da.length, mb = db.reduce(function (x, y) { return x + y; }, 0) / db.length, num = 0, va = 0, vb = 0; for (var i = 0; i < da.length; i++) { num += (da[i] - ma) * (db[i] - mb); va += (da[i] - ma) * (da[i] - ma); vb += (db[i] - mb) * (db[i] - mb); } return { c: Math.round((num / (Math.sqrt(va * vb) || 1)) * 100) / 100, n: da.length }; }  // P1: devolve n p/ gatear confiança (janela curta = correlação não-confiável)
    var pairs = [];
    for (var a = 0; a < reb.length; a++) for (var b = a + 1; b < reb.length; b++) { var cc2 = corr(reb[a], reb[b]); if (cc2 != null) pairs.push({ a: valid[a].nome, b: valid[b].nome, c: cc2.c, n: cc2.n }); }
    return { svg: o, leg: valid.map(function (x, i) { return { nome: x.nome, color: CMP_COLORS[i % 3], fim: reb[i].filter(function (v) { return v != null; }).slice(-1)[0] }; }), pairs: pairs, desde: grid[0], mn: mn, mx: mx };
  }

  // ── PAINEL DE TAXA-BASE (device estilo SentimenTrader): "em casos análogos, subiu em X% das vezes, mediana +Y% em 3/6/12m" ──
  // P7: distribuição empírica de casos passados, NUNCA previsão/sinal de trade. Degrada se s.base_rate ausente/incompleto.
  function baseRatePanel(br, L, pro) {
    if (!br || !br.h) return "";
    var HS = pro ? [["3m", "3m"], ["6m", "6m"], ["12m", "12m"]] : [["3m", "3m"]];  // free: só o 3m (diagnóstico); 6m/12m = investigação (Founder)
    var sgn = function (x) { return (x == null || !isFinite(x)) ? "—" : (x >= 0 ? "+" : "") + (Math.round(x * 10) / 10) + "%"; };
    var col = function (x) { return x == null ? "var(--_dim)" : x >= 0 ? "var(--_warm)" : "var(--_cool)"; };
    var rows = "", bars = "";
    for (var i = 0; i < HS.length; i++) {
      var hk = HS[i][0], d = br.h[hk]; if (!d) continue;
      var thin = (d.n == null || d.n < 8);  // GATE de amostra: < 8 casos = "amostra limitada", não destaca o hit
      var hit = (d.hit == null || !isFinite(d.hit)) ? null : Math.round(d.hit);
      var med = d.mediana, p25 = d.p25, p75 = d.p75;
      // linha forte: hit% destacado · mediana com sinal · faixa p25…p75 · n casos
      var hitTxt = (hit == null) ? "—" : (L ? "rose in " : "subiu em ") + '<b class="num" style="font-family:var(--_mono);color:' + (thin ? "var(--_dim)" : col(med)) + '">' + hit + '%</b>' + (L ? " of cases" : " dos casos");
      var rng = (p25 != null && p75 != null) ? ' · <span class="num" style="font-family:var(--_mono);color:var(--_dim)">' + sgn(p25) + '…' + sgn(p75) + '</span>' : "";
      var nTxt = (d.n != null) ? ' · <span style="color:var(--_dim)">' + d.n + (L ? " analogous cases" : " casos análogos") + '</span>' : "";
      // comparação condicional vs incondicional (o valor real do device): só fonte=knn, se base[hX] existe
      var vsBase = "";
      if (br.fonte === "knn" && br.base && br.base[hk] != null && isFinite(br.base[hk])) {
        vsBase = ' · <span style="color:var(--_dim)">' + (L ? "vs base " : "vs base ") + Math.round(br.base[hk]) + '%</span>';
      }
      var lim = thin ? ' <span style="color:var(--_dim)">(' + (L ? "limited sample" : "amostra limitada") + ')</span>' : "";
      rows += '<div class="rp-ml" style="margin-top:4px"><b style="color:var(--_dim);font-family:var(--_mono)">' + hk + '</b> · ' + hitTxt +
        ' · ' + (L ? "median " : "mediana ") + '<b style="color:' + (thin ? "var(--_dim)" : col(med)) + '">' + sgn(med) + '</b>' + rng + nTxt + vsBase + lim + '</div>';
      // mini-histograma: barra horizontal de hit% (escala 0-100), reusando o padrão .bar/i
      var w = (hit == null) ? 0 : Math.max(0, Math.min(100, hit));
      var bc = thin ? "var(--_dim)" : (med != null && med < 0 ? "var(--_cool)" : "var(--_warm)");
      bars += '<div style="display:flex;align-items:center;gap:7px;margin-top:5px"><span class="num" style="font-family:var(--_mono);font-size:9.5px;color:var(--_dim);width:22px;flex:none">' + hk + '</span>' +
        '<div class="bar" style="flex:1;margin-top:0"><i style="width:' + w + '%;background:' + bc + '"></i></div>' +
        '<span class="num" style="font-family:var(--_mono);font-size:9.5px;color:var(--_dim);width:26px;flex:none;text-align:right">' + (hit == null ? "—" : hit + "%") + '</span></div>';
    }
    if (!rows) return "";
    var src = (br.fonte === "knn") ? (L ? "k-NN analogs" : "análogos k-NN") : (L ? "broad base" : "base ampla");
    var out = '<div class="rp-ml" style="margin-top:11px"><b>' + (L ? "SIMILAR HISTORICAL CASES" : "CASOS HISTÓRICOS SEMELHANTES") + '</b>' +
      (br.alvo ? ' · <span style="color:var(--_dim)">' + esc(br.alvo) + '</span>' : '') +
      ' <span style="color:var(--_dim);opacity:.7">(' + src + ')</span></div>';
    out += rows;
    out += '<div style="margin-top:7px">' + bars + '</div>';
    if (!pro) out += '<div class="rp-ml" style="margin-top:5px;opacity:.92"><span style="color:var(--_accent)">🔒</span> ' + (L ? "6-month & 12-month horizons in Founder" : "prazos de 6 e 12 meses no Founder") + '</div>';  // free = só 3m; demais prazos = investigação paga
    out += '<div class="rp-ml" style="opacity:.6;margin-top:6px">' + (L ? "empirical distribution of past analogous cases — not a forecast" : "distribuição de casos análogos passados — não é previsão") + '</div>';
    return out;
  }

  function openBig(s, title, meta, lang, fund, preCmp) {
    if (!s || !s.hist || s.hist.length < 2) return; var L = lang === "en";
    // O gráfico grande é a MAIOR isca → free SEMPRE abre (sem gate de abertura). O upsell vem das FEATURES gated
    // dentro: manipular (zoom/brush), comparar A×B (Estúdio), cone completo p10–p90, overlays além dos 2 do free.
    var gpaid = (window.RP_PREMIUM === true); try { gpaid = gpaid || localStorage.getItem("rp_premium") === "1"; } catch (e) {}  // login (vale em qq lugar) ou flag local
    var cur = s.hist[s.hist.length - 1];
    var cone = (s.cone && s.cone.mid && s.cone.mid.length > 1) ? s.cone : null;
    var dp = function (v) { return (v != null && cur) ? Math.round(((v - cur) / Math.abs(cur)) * 1000) / 10 : null; };
    var sgn = function (x) { return (x >= 0 ? "+" : "") + x + "%"; };
    // gate embed-friendly: o widget só LINKA pro fluxo hospedado (login Google/Apple + Stripe vivem no domínio) — funciona de qualquer site (backlink)
    var checkout = (window.RP_CHECKOUT || (L ? "https://buy.stripe.com/cNi00idj40NZ91NgQTb3q03" : "https://buy.stripe.com/5kQ6oG3Iu40bem7asvb3q01"));  // Stripe Founder: EN=US$149 · PT=R$149
    var chartHTML = function (frac) { var n = s.hist.length, k = Math.max(8, Math.round(n * frac));
      return bigChart({ hist: s.hist.slice(n - k), proj: s.proj, cone: s.cone, bands: (frac >= 0.99 ? s.bands : null) }, { big: true, pro: gpaid }); };
    var lockHTML = '<div class="rp-lock"><b>' + (L ? "🔒 Manipulate & project the future — Founder" : "🔒 Manipular & projetar o futuro — Founder") + '</b><small>' + (L ? "Free range (drag-zoom), compare A×B and toggle overlays — plus the full asymmetric cone (p10–p90) with the past analogs overlaid. The history is here; with Founder you actually work it. Lock it all for US$149/mo while active — first 100 only." : "Período livre (arrasta-zoom), comparar A×B e ligar/desligar overlays — e o cone assimétrico completo (p10–p90) com os análogos passados sobrepostos. O histórico está aqui; com o Founder você trabalha ele. Trave tudo por R$149/mês enquanto ativo — só os 100 primeiros.") + '</small><em class="rp-anchor">' + (L ? "After the first 100, Vértice alone is US$290/mo. Right now both — Radar + Vértice — for US$149." : "Depois dos 100, o Vértice sozinho sai R$500/mês. Agora os dois — Radar + Vértice — por R$149.") + '</em><a class="cta" href="' + checkout + '" target="_blank" rel="noopener">' + (L ? "Get Founder — US$149/mo →" : "Quero o Founder — R$149/mês →") + '</a></div>';
    var h = '<div class="rp rp-mc" role="dialog" aria-modal="true"><button class="rp-x" aria-label="' + (L ? "close" : "fechar") + '">×</button>';
    h += '<div class="rp-mt">' + esc(title) + '</div>';
    if (fund) h += '<div class="rp-ml" style="margin-top:2px"><b>' + (L ? "Fundamentals · " : "Fundamentos · ") + '</b>' + esc(fund) + '</div>';
    // ★ disposição estilo SentimenTrader: a PILHA (preço·Ânima·risk) vem no TOPO p/ comparação visual imediata (usuário básico);
    //   os blocos de texto/stat (tendência, retornos, projeção, taxa-base, valuation) acumulam em `depth` e entram ABAIXO da pilha.
    var depth = "", trendBlk = "";  // trendBlk = Tendência + vs IBOV → sobem p/ a "Leitura rápida" (Camada 4), acima das estatísticas detalhadas
    if (s.trend && s.trend.score != null) { var tr = s.trend, sc = tr.score, seg = "";
      var tlab = sc >= 8 ? (L ? "strong uptrend" : "tendência forte") : sc >= 6 ? (L ? "uptrend" : "tendência de alta") : sc >= 4 ? (L ? "neutral" : "neutra") : sc >= 2 ? (L ? "weak" : "tendência fraca") : (L ? "downtrend" : "tendência de baixa");
      for (var si = 0; si < 10; si++) seg += '<span style="display:inline-block;width:8%;height:7px;margin-right:1.5%;border-radius:2px;background:' + (si < sc ? 'var(--_' + (tr.tom || 'neu') + ')' : 'var(--_line)') + '"></span>';
      trendBlk += '<div class="rp-ml" style="margin-top:6px"><b>' + (L ? "Trend " : "Tendência ") + sc + '/10</b> · ' + esc(tlab) + ' <span style="opacity:.6">(' + (L ? "close vs 50/100/200-day MAs, hierarchy, momentum" : "fecho vs médias 50/100/200, hierarquia, momentum") + ')</span></div><div style="margin-top:4px">' + seg + '</div>'; }
    if (s.trend_rel && s.trend_rel.score != null) { var trr = s.trend_rel.score;
      var trl = trr >= 8 ? (L ? "strongly outperforming the IBOV" : "forte vs IBOV") : trr >= 6 ? (L ? "outperforming the IBOV" : "acima do IBOV") : trr >= 4 ? (L ? "in line with the IBOV" : "em linha com o IBOV") : trr >= 2 ? (L ? "lagging the IBOV" : "abaixo do IBOV") : (L ? "strongly lagging the IBOV" : "fraco vs IBOV");
      trendBlk += '<div class="rp-ml"><b>' + (L ? "vs IBOV " : "vs IBOV ") + trr + '/10</b> · ' + esc(trl) + ' <span style="opacity:.6">(' + (L ? "the intermarket as a score" : "o intermercado com cara de score") + ')</span></div>'; }
    if (s.stats) { var st = s.stats;
      var labs = st.monthly ? [["m1", "1m"], ["m3", "3m"], ["m6", "6m"], ["y1", "12m"]] : [["d1", "1d"], ["w1", "1sem"], ["m1", "1m"], ["m3", "3m"], ["m6", "6m"], ["y1", "12m"]];
      var neutral = st.is_asset === false;  // P1: macro/fiscal — variação é fato, não bom/ruim; sem cor de valência
      var cells = labs.map(function (p) { var val = st.ret[p[0]]; if (val == null) return ""; var col = neutral ? "var(--_txt)" : (val >= 0 ? "var(--_warm)" : "var(--_cool)"); return '<span class="rp-st"><b style="color:' + col + '">' + (val >= 0 ? "+" : "") + val + '%</b><span>' + esc(L && p[1] === "1sem" ? "1w" : p[1]) + '</span></span>'; }).join("");
      if (cells) depth += '<div class="rp-ml" style="margin-top:9px"><b>' + (L ? "Returns" : "Retornos") + '</b></div><div class="rp-strip">' + cells + '</div>';
      if (st.pos52 != null) depth += '<div class="rp-ml" style="margin-top:8px">' + (L ? "52-week range · " : "Faixa de 52 semanas · ") + (L ? "low " : "mín ") + esc(fmtNum(st.lo52)) + ' ─ ' + (L ? "high " : "máx ") + esc(fmtNum(st.hi52)) + '</div><div class="rp-52"><i style="left:' + st.pos52 + '%"></i></div><div class="rp-ml" style="opacity:.6">' + (L ? "at " : "em ") + st.pos52 + (L ? "% of range" : "% da faixa") + '</div>';
      depth += '<div class="rp-ml" style="margin-top:6px"><b>' + (L ? "Volatility " : "Volatilidade ") + st.vol + '%</b> ' + (L ? "(annualized)" : "(anualizada)") + (st.dd_top != null ? ' · ' + (L ? "drawdown from peak " : "queda do topo ") + '<b style="color:var(--_cool)">' + st.dd_top + '%</b>' : '') + '</div>';
      if (st.sharpe != null) depth += '<div class="rp-ml"><b style="color:var(--_' + (st.sharpe >= 0 ? "warm" : "cool") + ')">Sharpe ' + st.sharpe + '</b> · ' + (L ? "risk-adjusted vs Selic " : "risco-ajustado vs Selic ") + st.rf + '% — ' + (st.sharpe >= 0 ? (L ? "beats the risk-free" : "supera a renda fixa") : (L ? "below the risk-free" : "abaixo da renda fixa")) + '</div>'; }
    h += '<div class="rp-ml">' + (cone ? (L ? "price · history → today → fan of outcomes from analogous cases (median case · range of the 50% and 80% of cases)" : "preço · histórico → hoje → leque de desfechos de casos análogos (caso mediano · faixa dos 50% e dos 80% dos casos)") : (L ? "price · history → today → projection (dashed)" : "preço · histórico → hoje → projeção (tracejada)")) + '</div>';
    // default = 3M: períodos longos comprimem anos num modal estreito ("tudo espremido"); abrir curto deixa o cone/preço legíveis. Free: 3M/6M livres, 1A/3A/MAX no Founder (gate). Decisão do dono.
    h += '<div class="rp-per">' + [["3", "3M"], ["6", "6M"], ["12", "1A"], ["36", "3A"], ["0", "MAX"]].map(function (p) {
      var m = parseFloat(p[0]); var locked = !gpaid && (m === 0 || m > 3);  // free = só 3M (decisão do dono); 6M/1A/3A/MAX = Founder. 0 = MAX (o mais longo)
      var cls = (p[0] === "3" ? "on" : "") + (locked ? " lock" : "");
      return '<button data-m="' + p[0] + '"' + (locked ? ' data-max="1"' : '') + (cls.trim() ? ' class="' + cls.trim() + '"' : '') + '>' + esc(p[1]) + (locked ? " 🔒" : "") + '</button>';
    }).join("") + '</div>';
    var useUp = uplotOn() && RP_UP.price;  // herói em uPlot? (flag on + engine pronta + price migrado)
    var hasStack = useUp && !!((s.anima && s.anima.serie && s.anima.serie.length > 1) || (s.risco && s.risco.serie && s.risco.serie.length > 1));  // tem oscilador empilhado? (preço esconde o eixo-X, datas vão p/ o painel de baixo)
    var SYNC = "rpbig" + (++_syncSeq);  // grupo de sync (crosshair + janela-x) deste modal: preço ↔ Ânima ↔ risk
    h += '<div class="rp-chart">' + (useUp ? '' : bigChart(s, { big: true })) + '</div>';  // uPlot desenha no div vazio depois do innerHTML
    if (!gpaid) {  // FREE: 2 overlays (1 projeção = cone/mediana + 1 indicador) — "gostinho"; manipular/comparar/cone-completo ficam no Founder
      var freeIds = ["cone"]; if (s.ma200 && s.ma200.length) freeIds.push("ma200");  // valor-justo (linha) = Founder; free vê o prêmio/desconto em TEXTO (decisão do dono)
      var fLbl = { cone: (L ? "Projection (median)" : "Projeção (mediana)"), fair: "Valuation (Lyn Alden)", ma200: "MM200" };
      h += '<div class="rp-tgf" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">' + freeIds.map(function (id) { var don = ((RP_LAYERS.filter(function (l) { return l.id === id; })[0]) || {}).defaultOn; return '<button class="rp-tog" data-fk="' + id + '" data-lbl="' + esc(fLbl[id]) + '" style="font-size:10px;background:var(--_card2);border:1px solid var(--_line);color:var(--_dim);border-radius:6px;padding:3px 9px;cursor:pointer">' + (don ? "● " : "○ ") + esc(fLbl[id]) + '</button>'; }).join("") + '<span class="rp-ml" style="opacity:.5">' + (L ? "· compare A×B & manipulate in Founder" : "· comparar A×B & manipular no Founder") + '</span></div>';
    }
    if (cone) { var dmid = dp(cone.mid[cone.mid.length - 1]);
      if (gpaid) { var dlo = dp(cone.lo[cone.lo.length - 1]), dhi = dp(cone.hi[cone.hi.length - 1]), dlo2 = (cone.lo2 ? dp(cone.lo2[cone.lo2.length - 1]) : null), dhi2 = (cone.hi2 ? dp(cone.hi2[cone.hi2.length - 1]) : null);
        if (dmid != null) depth += '<div class="rp-ml"><b style="color:var(--_warm)">' + (L ? "Median case " : "Caso mediano ") + sgn(dmid) + '</b>' + (dlo != null && dhi != null ? ' · ' + (L ? "50% of cases " : "50% dos casos ") + sgn(dlo) + ' … ' + sgn(dhi) : '') + (dlo2 != null && dhi2 != null ? ' · ' + (L ? "80% of cases " : "80% dos casos ") + sgn(dlo2) + ' … ' + sgn(dhi2) : '') + ' · ' + (L ? "in similar situations in the past — not a forecast" : "em situações parecidas no passado — não é previsão") + '</div>'; }
      else if (dmid != null) depth += '<div class="rp-ml"><b style="color:var(--_warm)">' + (L ? "Median case " : "Caso mediano ") + sgn(dmid) + '</b> · ' + (L ? "where it tended to go in analogous cases — not a forecast" : "pra onde costumou ir em casos análogos — não é previsão") + ' · <span style="opacity:.72">' + (L ? "🔒 50% / 80% of cases in Founder" : "🔒 faixas dos 50% / 80% dos casos no Founder") + '</span></div>'; }
    else { var dpct = dp((s.proj && s.proj.length > 1) ? s.proj[s.proj.length - 1] : null);
      if (dpct != null) depth += '<div class="rp-ml"><b style="color:var(--_warm)">' + (L ? "projection " : "projeção ") + sgn(dpct) + '</b> · ' + (L ? "linear, under current conditions — not a forecast" : "linear, sob condições atuais — não é previsão") + '</div>'; }
    if (s.base_rate && s.base_rate.h) depth += baseRatePanel(s.base_rate, L, gpaid);  // taxa-base (casos análogos) — free: só 3m; 6m/12m no Founder (gpaid)
    if (s.fair && s.fair.premio_pct != null) { var isFii = s.fair.tipo === "fii";
      depth += '<div class="rp-ml" style="margin-top:6px">' + (isFii ? (L ? "Net asset value (NAV) " : "Valor patrimonial (NAV) ") : "Valuation · Lyn Alden ") + '<b style="color:var(--_warm)">' + (s.fair.premio_pct >= 0 ? "+" : "") + esc(s.fair.premio_pct) + '%</b> ' + (isFii ? ((L ? "vs price · P/NAV " : "vs preço · P/VP ") + esc(s.fair.pvp) + ' · ' + (L ? "anchored on the fund’s book value, descriptive" : "ancorado no patrimônio do fundo, descritivo")) : ((L ? "vs price · earnings × normal P/E " : "vs preço · lucro × P/L normal ") + esc(s.fair.pe_normal) + ' (' + (L ? "now " : "hoje ") + esc(s.fair.pe_now) + ') · ' + (L ? "anchored on the company’s own earnings, descriptive" : "ancorado no próprio lucro da empresa, descritivo"))) + '</div>'; }
    if (s.dcf && s.dcf.iv != null) depth += '<div class="rp-ml" style="margin-top:4px">' + (L ? "DCF intrinsic " : "DCF intrínseco ") + '<b>R$ ' + esc(s.dcf.iv) + '</b> · ' + (L ? "price " : "preço ") + '<b style="color:var(--_' + (s.dcf.premio_pct >= 0 ? "warm" : "cool") + ')">' + (s.dcf.premio_pct >= 0 ? "+" : "") + esc(s.dcf.premio_pct) + '%</b> · ' + (L ? "model from cash flow (growth " : "modelo do fluxo de caixa (cresc. ") + esc(s.dcf.g) + '% · ' + (L ? "discount " : "desconto ") + esc(s.dcf.r) + '%) — ' + (L ? "assumptions shown, not a forecast" : "premissas à mostra, não previsão") + '</div>';
    // ★ painéis empilhados (SentimenTrader): Ânima (humor) + Risk-on/off (regime), alinhados ao preço pela data — crosshair único atravessa os 3
    var aSel = animaActive(s, "estr", gpaid), aObj = aSel.obj;  // ★ Ânima: free=estrutural (252d), curto (63d)=Founder — seletor de horizonte
    var animaOk = !!aObj, riscoOk = s.risco && s.risco.serie && s.risco.serie.length > 1;
    if (useUp) {  // uPlot: placeholders vazios; os osciladores sincronizados montam após o innerHTML (mountStackOsc + wireAnima)
      if (animaOk) h += animaSelHTML(aSel, lang) + '<div class="rp-ml rp-anima-cap" style="margin-top:9px">' + esc(animaCap(aObj, lang, aSel.mode)) + '</div><div class="rp-osc rp-anima"></div>';
      if (riscoOk) h += '<div class="rp-ml" style="margin-top:7px">' + esc(oscCaption(s.risco, lang, "risk")) + '</div><div class="rp-osc rp-risk"></div>';
    } else {  // SVG (embed/fallback): osciladores estáticos
      if (animaOk) h += '<div class="rp-ml" style="margin-top:9px">' + esc(animaCap(aObj, lang, aSel.mode)) + '</div>' + riskPane(aObj, { big: true });
      if (riscoOk) h += '<div class="rp-ml" style="margin-top:7px">' + esc(oscCaption(s.risco, lang, "risk")) + '</div>' + riskPane(s.risco, { big: true });
    }
    // indicadores de domínio (cripto: Fear&Greed/TVL; ações: volume) → leitura TEXTUAL (a pilha empilhada é o gráfico padrão de todos)
    h += oscTextLine(s.hist2, s.hist2_label, lang) + oscTextLine(s.hist3, s.hist3_label, lang);
    // ★ Camada 4 — "Leitura rápida": interpretação resumida (Regime · Humor · Tendência · vs IBOV) ANTES do muro de estatísticas. P7: só rótulos de estado, nunca recomendação.
    if ((riscoOk || animaOk || trendBlk) && !(preCmp && preCmp.length >= 2)) {
      var lr = '<div class="rp-ml" style="margin-top:11px;font-weight:700;letter-spacing:.03em">' + (L ? "QUICK READ" : "LEITURA RÁPIDA") + '</div>';
      if (riscoOk) lr += '<div class="rp-ml" style="margin-top:3px">' + (L ? "Regime · " : "Regime · ") + '<b>' + esc(rkPos(s.risco, L)) + '</b> <span style="opacity:.6">(' + (L ? "risk appetite" : "apetite ao risco") + ')</span></div>';
      if (animaOk) lr += '<div class="rp-ml">' + (L ? "Mood · " : "Humor · ") + '<b>' + esc(rkPos(aObj, L)) + '</b> <span style="opacity:.6">(' + (L ? "BR market" : "mercado BR") + ')</span></div>';
      h += lr + trendBlk;  // trendBlk = Tendência X/10 + vs IBOV Y/10
    }
    h += depth;  // ★ estatísticas detalhadas (retornos/52s/vol/Sharpe/taxa-base/valuation) — abaixo da Leitura rápida e da pilha de gráficos
    if (meta && !(preCmp && preCmp.length >= 2)) h += '<div class="rp-ml" style="margin-top:9px">' + (L ? "relation — " : "relação — ") + esc(meta) + '</div>';  // no comparativo lead-lag a interpretação vira legenda do gráfico (não duplica aqui)
    h += '<div class="rp-ml" style="margin-top:9px">' + (L ? "descriptive, never a recommendation · full depth (custom ranges, correlations, scenarios) in the app →" : "descritivo, nunca recomendação · profundidade completa (períodos, correlações, cenários) no app →") + '</div></div>';
    var mw = document.createElement("div"); mw.className = "rp-mw"; mw.innerHTML = h;
    function close() { if (mw.parentNode) mw.parentNode.removeChild(mw); document.removeEventListener("keydown", onkey); }
    function onkey(e) { if (e.key === "Escape") close(); }
    mw.addEventListener("click", function (e) { var t = e.target; if (t === mw || (t.getAttribute && t.getAttribute("aria-label") && t.className === "rp-x")) close(); });
    // seletor de período: janelas livres re-renderizam o gráfico; [MAX 🔒] mostra o gate (login+Stripe hospedado)
    var chartEl = mw.querySelector(".rp-chart"), perBtns = mw.querySelectorAll(".rp-per button");
    var curHist = s.hist, winStart = 0, brushing = false, bx0 = 0;  // winStart = índice ABSOLUTO em s.hist onde a janela atual começa (zoom/período); brushing = arrastando p/ zoom (só assinante)
    var ov = {}; RP_LAYERS.forEach(function (l) { if (l.available(s)) ov[l.id] = l.defaultOn; });  // estado dos overlays vem do REGISTRO (não mais hardcoded) — default: Valor-justo + Cone ligados, resto a 1 clique
    if (!gpaid) ov.fair = false;  // ★ linha de valor-justo = Founder (free vê só o TEXTO prêmio/desconto); decisão do dono
    var compareActive = false;  // estúdio em modo cruzamento (desliga crosshair/brush de ticker único)
    var xh = document.createElement("div"); xh.className = "rp-xh"; xh.style.display = "none";
    var xt = document.createElement("div"); xt.className = "rp-xt"; xt.style.display = "none";
    var bsel = document.createElement("div"); bsel.className = "rp-bsel"; bsel.style.display = "none";  // retângulo de seleção do brush
    var rbtn = document.createElement("button"); rbtn.className = "rp-reset"; rbtn.textContent = "↺ reset zoom"; rbtn.style.display = "none";  // volta ao período ativo
    var yax = document.createElement("div"); yax.className = "rp-yax";
    // rótulos de valor (eixo-Y) em HTML — SVG sob preserveAspectRatio=none distorce texto; HTML escala fiel.
    // mesmo range que o bigChart (inclui cone/proj); posições alinhadas às linhas mín/centro/máx (pT/pB=6 de H=120 → banda 5%–95%).
    function buildYax(hist, wf) { wf = wf !== false;
      var all = hist.slice();
      if (wf && s.cone && s.cone.mid && s.cone.mid.length > 1) { if (gpaid) all = all.concat((s.cone.lo2 || s.cone.lo).slice(1), (s.cone.hi2 || s.cone.hi).slice(1)); else all = all.concat(s.cone.mid.slice(1)); }  // casa com o range do bigChart (free=só mediana; pro=p10–p90)
      else if (wf && s.proj && s.proj.length > 1) all = all.concat(s.proj.slice(1));
      var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), rg = (mx - mn) || 1;
      return [[5, mx], [27.5, mn + 0.75 * rg], [50, mn + 0.5 * rg], [72.5, mn + 0.25 * rg], [95, mn]].map(function (p) {  // 5 níveis alinhados às gridlines (eixo mais legível p/ análise precisa)
        return '<span class="rp-yl" style="top:' + p[0] + '%">' + esc(fmtNum(p[1])) + '</span>'; }).join("");
    }
    // ── uPlot (Sprint 1, herói): clona s refletindo os toggles free e (re)instancia upPrice no chartEl. ──
    //    Mantido num builder p/ o re-tema (MutationObserver) re-desenhar com a paleta nova.
    var _upInst = null;  // instância uPlot viva (ou null em modo SVG)
    var _navClamp = null;  // FREE: janela navegável permitida {min,max} (período selecionado → fim do cone); Founder = null (sem limite). setado em setChart.
    function drawUp(el) {  // el = chartEl; lê o estado de overlays `ov` (free liga/desliga cone/fair/ma200)
      var sv = {};
      for (var kk in s) if (Object.prototype.hasOwnProperty.call(s, kk)) sv[kk] = s[kk];
      if (ov.cone === false) { sv.cone = null; sv.shadow = null; }   // toggle "Projeção" off → sem cone/sombra
      if (!ov.fair) sv.fair = null;                                   // toggle "Valor-justo" off
      if (!ov.ma200) sv.ma200 = null;
      if (!ov.ma50) sv.ma50 = null;
      if (!ov.bands) sv.bands = null;
      // plugins (Bollinger etc.) ligados → computa e injeta p/ o upPrice desenhar como séries de linha (paridade com o SVG)
      sv._plugins = RP_LAYERS.filter(function (l) { return l.kind === "plugin" && ov[l.id] && l.available(s); })
        .map(function (l) { return { id: l.id, data: l.compute(s.hist) }; });
      if (_upInst && _upInst.destroy) { try { _upInst.destroy(); } catch (e) {} }
      _upInst = window.RPUplot.upPrice(el, sv, { big: true, pro: gpaid, sync: SYNC, lang: lang, hideX: hasStack, axisW: 52, height: 200, nav: true, clamp: function () { return _navClamp; }, sinais: s.sinais, onReset: function () { var on = mw.querySelector(".rp-per button.on"); var fr = (on && on.getAttribute("data-m") != null) ? parseFloat(on.getAttribute("data-m")) : 3; setChart(isFinite(fr) ? fr : 3); } });  // sync: crosshair+janela com Ânima/risk · hideX: datas só no painel de baixo · sinais: pinos do buy signal · onReset: dblclick volta ao período ATIVO (default 3M)
      return _upInst;
    }
    function tsAt(idx) {  // timestamp (epoch-s) da data no índice idx de s.hist; fallback null
      if (!s.datas || s.datas.length !== s.hist.length) return null;
      var t = Date.parse(String(s.datas[idx]).length <= 10 ? s.datas[idx] + "T00:00:00Z" : s.datas[idx]);
      return isFinite(t) ? t / 1000 : null;
    }
    function paint(histArr, wf) { wf = wf !== false;  // wf=mostra futuro (cone/proj); zoom num período passado desliga
      if (useUp) { drawUp(chartEl); return; }  // uPlot: redesenha (cone/fair/ma seguem os toggles); zoom/eixo são nativos
      var ws = winStart, we = winStart + histArr.length;  // janela ABSOLUTA em s.hist → fatia TUDO igual (sombra/MM/valor-justo), inclusive zoom não-tail
      var shSl = (ov.cone !== false && s.shadow && s.shadow.lo) ? { lo: s.shadow.lo.slice(ws, we), hi: s.shadow.hi.slice(ws, we) } : null;
      var ma2Sl = (ov.ma200 && s.ma200) ? s.ma200.slice(ws, we) : null, ma5Sl = (ov.ma50 && s.ma50) ? s.ma50.slice(ws, we) : null;
      var fairSl = (ov.fair && s.fair && s.fair.serie) ? s.fair.serie.slice(ws, we) : null;  // valor-justo fatiado pela MESMA janela → não some mais no zoom (bug 2)
      var plugins = RP_LAYERS.filter(function (l) { return l.kind === "plugin" && ov[l.id] && l.available(s); });  // camadas-plugin habilitadas (drop-in)
      chartEl.innerHTML = bigChart({ hist: histArr, proj: (wf ? s.proj : null), cone: (wf ? s.cone : null), bands: (wf && ov.bands ? s.bands : null) }, { big: true, pro: gpaid, fair: fairSl, cone: ov.cone, shadow: (wf ? shSl : null), ma200: ma2Sl, ma50: ma5Sl, plugins: plugins, futFair: (wf && ov.fair && s.fair && s.fair.serie_fut) ? s.fair.serie_fut : null });  // overlays + sombra + MMs + plugins + valor-justo futuro (bug 3)
      yax.innerHTML = buildYax(histArr, wf);
      chartEl.appendChild(yax); chartEl.appendChild(xh); chartEl.appendChild(xt); chartEl.appendChild(bsel);
    }
    function setChart(m) {  // m = meses de janela (0 = MAX) — corte por DATA (s.datas), pra ações de ~5a manterem os períodos curtos
      var i0 = 0;
      if (m && s.datas && s.datas.length === s.hist.length) {
        var last = s.datas[s.datas.length - 1], cut = new Date(last); cut.setMonth(cut.getMonth() - m); var cs = cut.toISOString().slice(0, 10);
        while (i0 < s.datas.length && s.datas[i0] < cs) i0++;
        if (i0 > s.datas.length - 3) i0 = Math.max(0, s.datas.length - 3);  // piso de 3 pontos: em série MENSAL, "3M" = 3 pontos; salvaguarda antiga (len-8) inflava o 3M p/ ~8 meses
      }
      curHist = i0 ? s.hist.slice(i0) : s.hist; winStart = i0;
      rbtn.style.display = "none";
      if (useUp) {  // uPlot: SEMPRE re-desenha honrando o estado atual dos overlays (ov) — senão toggle de overlay em período finito (6M/1A/3A) era ignorado (só setScale). Depois aplica a janela.
        drawUp(chartEl);  // (re)cria com os overlays atuais — auto-range já inclui hist+futuro
        if (_upInst) {  // SEMPRE setScale (com números, nunca null) → a janela propaga aos painéis sincronizados (Ânima/risk) inclusive no MAX
          var xarr = _upInst.data && _upInst.data[0], maxFull = (xarr && xarr.length) ? xarr[xarr.length - 1] : null;  // último ts do eixo — inclui o futuro do cone
          var mn = m ? tsAt(i0) : ((xarr && xarr.length) ? xarr[0] : null);
          var endTs = tsAt(s.hist.length - 1);
          var futSpan = (maxFull != null && endTs != null) ? (maxFull - endTs) : 0;  // largura do cone/futuro
          var mx = (maxFull != null ? maxFull : endTs) + futSpan * 0.08;  // SEMPRE até o fim do cone (+folga) — o leque é o diferencial, nunca cortar; o min (mn) define a janela de histórico
          if (mn != null && mx != null && mx > mn) { _upInst.setScale("x", { min: mn, max: mx }); _navClamp = gpaid ? null : { min: mn, max: mx }; }  // FREE: trava a navegação nesta janela (zoom/pan dentro, sem escapar pro passado)
        }
        return;
      }
      paint(curHist, true);
    }
    if (useUp) { _upMounted.push({ el: chartEl, draw: drawUp }); }  // registra p/ re-tema (re-desenha no toggle claro/escuro)
    document.body.appendChild(mw);  // ★ modal no DOM ANTES do setChart — uPlot monta em elemento vivo/dimensionado (senão erra e o modal nem abre)
    // osciladores PRIMEIRO, preço POR ÚLTIMO: o link-group propaga a janela do último a setá-la → o preço (setChart) impõe
    // a janela a Ânima/risk (senão o autoscale dos osciladores na montagem sobrescreveria o período do preço).
    if (useUp) { mountStackOsc(mw.querySelector(".rp-anima"), mw.querySelector(".rp-risk"), s, SYNC, lang, true, aObj, gpaid); wireAnima(mw, s, lang, gpaid, SYNC, true); }  // osciladores empilhados (Ânima/risk) no MESMO grupo de sync/janela do preço + seletor de horizonte
    setChart(3);  // abre em 3M (default legível); MAX/longos via botões (gated p/ free)
    if (useUp && typeof requestAnimationFrame === "function") requestAnimationFrame(function () { setChart(3); });  // reaplica a janela após o layout/ResizeObserver dos osciladores assentar no mount (senão o auto-range deles re-propaga "tudo" e o 3M inicial era ignorado)
    if (!gpaid) {  // free: liga/desliga os 2 overlays + repinta (sem estúdio/manipulação)
      mw.querySelectorAll(".rp-tog[data-fk]").forEach(function (el) {
        el.addEventListener("click", function () { var k = el.getAttribute("data-fk"); ov[k] = !ov[k]; el.textContent = (ov[k] ? "● " : "○ ") + el.getAttribute("data-lbl"); paint(curHist, true); });
      });
    }
    // ★ ESTÚDIO (TradingView): cruzar até 3 séries (qualquer classe) + escolher camadas — só assinante
    if (gpaid) {
      var cmp = (preCmp && preCmp.length >= 2) ? preCmp.slice() : [{ cod: s.codigo, cls: s.classe, nome: title }];  // A = ticker atual (ou pré-carga do intermercado)
      var cmpCache = {}; cmpCache[s.classe + ":" + s.codigo] = s;
      var perRow = mw.querySelector(".rp-per");
      var studio = document.createElement("div"); studio.style.cssText = "margin:8px 0 4px";
      // controles avançados ABAIXO da pilha preço·Ânima·risk: o gráfico é o centro (hierarquia "ver→entender"), os botões não empurram o hero p/ baixo. Decisão do dono.
      var stackTail = mw.querySelector(".rp-osc.rp-risk") || mw.querySelector(".rp-osc.rp-anima") || chartEl;
      stackTail.parentNode.insertBefore(studio, stackTail.nextSibling);
      var legEl = document.createElement("div"); legEl.style.marginTop = "4px"; chartEl.parentNode.insertBefore(legEl, chartEl.nextSibling);
      var btnCss = "font-family:var(--_mono);font-size:10px;background:var(--_card2);border:1px solid var(--_line);color:var(--_dim);border-radius:5px;padding:3px 9px;cursor:pointer";
      var fetchSerie = function (cod, cls, cb) {
        var key = cls + ":" + cod; if (cmpCache[key]) return cb(cmpCache[key]);
        fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(cod) + "&classe=" + encodeURIComponent(cls), FOPT)
          .then(function (r) { return r.json(); }).then(function (d) { cmpCache[key] = d; cb(d); }).catch(function () { cb(null); });
      };
      var drawCompare = function (got) {
        var cc = compareChart(got.filter(Boolean), lang, { big: true });
        if (!cc) { chartEl.innerHTML = '<div class="rp-ml" style="opacity:.7;padding:18px 0;text-align:center">' + (L ? "no time overlap between these series" : "sem sobreposição temporal entre essas séries") + '</div>'; legEl.innerHTML = ""; return; }
        chartEl.innerHTML = cc.svg;
        yax.innerHTML = [[5, cc.mx], [50, (cc.mn + cc.mx) / 2], [95, cc.mn]].map(function (p) { return '<span class="rp-yl" style="top:' + p[0] + '%">' + esc(Math.round(p[1])) + '</span>'; }).join("");  // eixo-Y do cruzamento (base 100) — referência não some mais
        chartEl.appendChild(yax);
        legEl.innerHTML = (meta ? '<div class="rp-ml" style="margin-top:3px"><b style="color:var(--_accent)">Lead-lag</b> — ' + esc(meta) + '</div>' : '') + '<div class="rp-ml" style="margin-top:3px">' + cc.leg.map(function (x) { return '<span style="white-space:nowrap;margin-right:9px"><b style="color:' + x.color + '">▬</b> ' + esc(x.nome) + (x.fim != null ? ' <span style="opacity:.7">' + (x.fim >= 100 ? "+" : "") + Math.round(x.fim - 100) + '%</span>' : '') + '</span>'; }).join("") + '</div><div class="rp-ml" style="opacity:.75">' + (L ? "rebased to 100 · monthly · since " : "rebaseado a 100 · mensal · desde ") + esc(cc.desde) + (cc.pairs.length ? ' · ' + cc.pairs.map(function (p) { var lowc = p.n < 24; return esc(p.a) + '×' + esc(p.b) + ' corr ' + p.c + (lowc ? ' <span style="color:var(--_warm);opacity:.9">(' + (L ? "short window · n=" : "janela curta · n=") + p.n + (L ? "m, low confidence" : "m, baixa confiança") + ')</span>' : ''); }).join(" · ") : '') + '</div>';
      };
      var applyMode = function () {
        renderStudio();
        if (cmp.length >= 2) {
          compareActive = true; if (perRow) perRow.style.display = "none"; rbtn.style.display = "none"; xh.style.display = "none"; xt.style.display = "none";
          var pend = cmp.length, got = [];
          cmp.forEach(function (c, i) { fetchSerie(c.cod, c.cls, function (d) { got[i] = (d && d.hist) ? { nome: c.nome, hist: d.hist, datas: d.datas } : null; if (--pend === 0) drawCompare(got); }); });
        } else {
          compareActive = false; if (perRow) perRow.style.display = ""; legEl.innerHTML = "";
          var on = mw.querySelector(".rp-per button.on"); var fr = (on && on.getAttribute("data-m") != null) ? parseFloat(on.getAttribute("data-m")) : 0; setChart(isFinite(fr) ? fr : 0);
        }
      };
      var openPicker = function () {
        if (studio.querySelector(".rp-pkbox")) { studio.querySelector(".rp-pkbox").remove(); return; }
        var pk = document.createElement("div"); pk.className = "rp-pkbox"; pk.style.cssText = "margin-top:5px;max-height:170px;overflow:auto;border:1px solid var(--_line);border-radius:7px;padding:6px;background:var(--_card2)";
        var chosen = {}; cmp.forEach(function (c) { chosen[c.cls + ":" + c.cod] = 1; });
        var html = "";
        RP_CAT.forEach(function (g) {
          var items = g.items.filter(function (it) { return !chosen[it.cls + ":" + it.cod]; });
          if (!items.length) return;
          html += '<div class="rp-ml" style="opacity:.6;margin-top:3px">' + esc(g.cat) + '</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">' + items.map(function (it) { return '<button class="rp-pk" data-cod="' + esc(it.cod) + '" data-cls="' + esc(it.cls) + '" data-nome="' + esc(it.nome) + '" style="font-family:var(--_mono);font-size:10px;background:transparent;border:1px solid var(--_line);color:var(--_dim);border-radius:4px;padding:2px 7px;cursor:pointer">' + esc(it.nome) + '</button>'; }).join("") + '</div>';
        });
        pk.innerHTML = html || '<div class="rp-ml" style="opacity:.6">' + (L ? "nothing else to add" : "nada mais a adicionar") + '</div>';
        studio.appendChild(pk);
        pk.querySelectorAll(".rp-pk").forEach(function (el) { el.addEventListener("click", function (e) { e.stopPropagation(); if (cmp.length >= 3) return; cmp.push({ cod: el.getAttribute("data-cod"), cls: el.getAttribute("data-cls"), nome: el.getAttribute("data-nome") }); applyMode(); }); });
      };
      var renderStudio = function () {
        var html = '<div class="rp-ml" style="opacity:.7">' + (L ? "Studio · cross up to 3 (any series)" : "Estúdio · cruze até 3 (qualquer série)") + '</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;align-items:center">';
        cmp.forEach(function (c, i) { html += '<span data-rm="' + i + '" style="font-family:var(--_mono);font-size:10px;border:1px solid ' + CMP_COLORS[i % 3] + ';color:var(--_dim);border-radius:5px;padding:2px 8px' + (i > 0 ? ';cursor:pointer' : '') + '"><b style="color:' + CMP_COLORS[i % 3] + '">▬</b> ' + esc(c.nome) + (i > 0 ? ' ✕' : '') + '</span>'; });
        if (cmp.length < 3) html += '<button class="rp-add" type="button" style="font-family:var(--_mono);font-size:10px;background:var(--_card2);border:1px dashed var(--_line);color:var(--_dim);border-radius:5px;padding:3px 9px;cursor:pointer">+ ' + (L ? "compare" : "comparar") + '</button>';
        html += '</div>';
        if (cmp.length === 1) {
          var curG = s.g === "m" ? "m" : "d";  // ★ cadência: muda a PROJEÇÃO (cone/valor-justo/MMs/vol recomputam diário vs mensal)
          html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center"><span class="rp-ml" style="opacity:.6;margin-right:1px">' + (L ? "Cadence:" : "Cadência:") + '</span>' + [["d", L ? "Daily" : "Diário"], ["m", L ? "Monthly" : "Mensal"]].map(function (gg) { return '<button class="rp-gtog" data-g="' + gg[0] + '" style="' + btnCss + (curG === gg[0] ? ";border-color:var(--_accent);color:var(--_accent);font-weight:700" : "") + '">' + esc(gg[1]) + '</button>'; }).join("") + '</div>';
          var mc = (s.ma_n && s.ma_n[0]) || 50, ml = (s.ma_n && s.ma_n[1]) || 200, mu = curG === "m" ? "m" : "d";
          var lctx = { L: L, s: s, mu: mu, mc: mc, ml: ml };
          var togs = RP_LAYERS.filter(function (l) { return l.available(s); }).map(function (l) { return [l.id, l.label(lctx)]; });  // chips vêm do REGISTRO — disponibilidade + rótulo declarativos; novo plugin aparece sozinho
          if (togs.length) html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px">' + togs.map(function (t) { return '<button class="rp-tog" data-k="' + t[0] + '" style="' + btnCss + '">' + (ov[t[0]] ? "● " : "○ ") + esc(t[1]) + '</button>'; }).join("") + '</div>';
        }
        studio.innerHTML = html;
        studio.querySelectorAll("[data-rm]").forEach(function (el) { var idx = +el.getAttribute("data-rm"); if (idx > 0) el.addEventListener("click", function () { cmp.splice(idx, 1); applyMode(); }); });
        var addb = studio.querySelector(".rp-add"); if (addb) addb.addEventListener("click", openPicker);
        studio.querySelectorAll(".rp-tog").forEach(function (el) { el.addEventListener("click", function () { var k = el.getAttribute("data-k"); ov[k] = ov[k] === false ? true : false; applyMode(); }); });
        studio.querySelectorAll(".rp-gtog").forEach(function (el) { el.addEventListener("click", function () { var gg = el.getAttribute("data-g"); if (gg === (s.g === "m" ? "m" : "d")) return; close(); fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(s.codigo) + "&classe=" + encodeURIComponent(s.classe) + "&g=" + gg, FOPT).then(function (r) { return r.json(); }).then(function (ns) { if (ns && ns.hist && ns.hist.length) openBig(ns, title, meta, lang, fund); }); }); });  // troca diário↔mensal → re-busca + reabre (recomputa a projeção)
      };
      if (cmp.length >= 2) applyMode(); else renderStudio();  // pré-carga (intermercado) abre já em modo compare
    }
    else if (preCmp && preCmp.length >= 2) {  // FREE + comparar (intermercado): overlay LEAD-LAG read-only (3 séries rebaseadas, diagnóstico citável); cruzar/manipular = Founder
      compareActive = true;
      var perRowF = mw.querySelector(".rp-per"); if (perRowF) perRowF.style.display = "none";  // os períodos eram do ativo único
      var tgfF = mw.querySelector(".rp-tgf"); if (tgfF) tgfF.style.display = "none";            // idem os 2 toggles do ativo único
      var legF = document.createElement("div"); legF.style.marginTop = "4px"; chartEl.parentNode.insertBefore(legF, chartEl.nextSibling);
      var gotF = [], pendF = preCmp.length;
      preCmp.forEach(function (c, i) {
        fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(c.cod) + "&classe=" + encodeURIComponent(c.cls), FOPT)
          .then(function (r) { return r.json(); }).then(function (d) {
            gotF[i] = (d && d.hist) ? { nome: c.nome, hist: d.hist, datas: d.datas } : null;
            if (--pendF === 0) {
              var cc = compareChart(gotF.filter(Boolean), lang, { big: true });
              if (!cc) { chartEl.innerHTML = '<div class="rp-ml" style="opacity:.7;padding:18px 0;text-align:center">' + (L ? "no time overlap between these series" : "sem sobreposição temporal entre essas séries") + '</div>'; return; }
              chartEl.innerHTML = cc.svg;
              yax.innerHTML = [[5, cc.mx], [50, (cc.mn + cc.mx) / 2], [95, cc.mn]].map(function (p) { return '<span class="rp-yl" style="top:' + p[0] + '%">' + esc(Math.round(p[1])) + '</span>'; }).join("");
              chartEl.appendChild(yax);
              legF.innerHTML = (meta ? '<div class="rp-ml" style="margin-top:3px"><b style="color:var(--_accent)">Lead-lag</b> — ' + esc(meta) + '</div>' : '') + '<div class="rp-ml" style="margin-top:3px">' + cc.leg.map(function (x) { return '<span style="white-space:nowrap;margin-right:9px"><b style="color:' + x.color + '">▬</b> ' + esc(x.nome) + (x.fim != null ? ' <span style="opacity:.7">' + (x.fim >= 100 ? "+" : "") + Math.round(x.fim - 100) + '%</span>' : '') + '</span>'; }).join("") + '</div><div class="rp-ml" style="opacity:.75">' + (L ? "rebased to 100 · monthly · since " : "rebaseado a 100 · mensal · desde ") + esc(cc.desde) + (cc.pairs && cc.pairs.length ? ' · ' + cc.pairs.map(function (p) { return esc(p.a) + '×' + esc(p.b) + ' corr ' + p.c; }).join(" · ") : '') + '</div><div class="rp-ml" style="margin-top:4px"><span style="color:var(--_accent)">🔒</span> ' + (L ? "cross any series & drag-zoom in Founder" : "cruzar qualquer série & zoom no Founder") + '</div>';
            }
          }).catch(function () { });
      });
    }
    if (!useUp) chartEl.addEventListener("mousemove", function (e) {  // crosshair sincronizado (guia + valor no ponto) — em uPlot o cursor é nativo, não bindamos o manual (risco #2)
      if (brushing || compareActive) return;  // durante o arraste/modo compare, o crosshair de ticker único não vale
      var rect = chartEl.getBoundingClientRect(), fx = (e.clientX - rect.left) / rect.width;
      if (fx < 0 || fx > 1 || !curHist || curHist.length < 2) { xh.style.display = "none"; xt.style.display = "none"; return; }
      var val = curHist[Math.round(fx * (curHist.length - 1))];
      xh.style.display = "block"; xh.style.left = (fx * 100) + "%";
      xt.style.display = "block"; xt.style.left = (fx * 100) + "%"; xt.textContent = fmtNum(val);
    });
    if (!useUp) chartEl.addEventListener("mouseleave", function () { xh.style.display = "none"; xt.style.display = "none"; });
    // ★ MANIPULAÇÃO (só assinante): arrastar no gráfico dá zoom num período livre. Visitante free nunca recebe estes handlers.
    //    Em uPlot o drag-zoom é nativo → NÃO bindamos o brush manual (colide com o cursor/zoom do uPlot, risco #2).
    if (gpaid && !useUp) {
      chartEl.style.cursor = "crosshair";
      chartEl.parentNode.insertBefore(rbtn, chartEl.nextSibling);
      var hint = document.createElement("div"); hint.className = "rp-ml"; hint.style.opacity = ".6"; hint.style.marginTop = "3px";
      hint.textContent = (L ? "↔ drag (or touch-drag on mobile) to zoom any period · tap = crosshair · ↺ resets" : "↔ arraste (ou toque-e-arraste no celular) pra dar zoom · toque = crosshair · ↺ reseta"); chartEl.parentNode.insertBefore(hint, rbtn);
      // ── manipulação unificada MOUSE + TOQUE (mobile/tablet) — tocar mostra o crosshair, arrastar dá zoom livre. Meta: zerar limitações no avançado.
      var getX = function (e) { return (e.touches && e.touches[0]) ? e.touches[0].clientX : (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : e.clientX; };
      var showXt = function (fx) { if (curHist && curHist.length > 1) { xt.style.display = "block"; xt.style.left = (fx * 100) + "%"; xt.textContent = fmtNum(curHist[Math.round(fx * (curHist.length - 1))]); } };
      var brect = null;  // rect cacheado no início do arraste — não muda durante o gesto; evita forçar layout a cada move (perf, sobretudo toque mobile)
      var startBrush = function (e) {
        if (compareActive) return; brect = chartEl.getBoundingClientRect(); bx0 = (getX(e) - brect.left) / brect.width;
        if (bx0 < 0 || bx0 > 1) return; brushing = true;
        bsel.style.display = "block"; bsel.style.left = (bx0 * 100) + "%"; bsel.style.width = "0";
        xh.style.display = "block"; xh.style.left = (bx0 * 100) + "%"; showXt(bx0); if (e.cancelable) e.preventDefault();
      };
      var moveBrush = function (e) {
        if (!brushing) return; if (e.cancelable) e.preventDefault();
        var rect = brect || chartEl.getBoundingClientRect(), fx = Math.max(0, Math.min(1, (getX(e) - rect.left) / rect.width));
        var a = Math.min(bx0, fx), b = Math.max(bx0, fx); bsel.style.left = (a * 100) + "%"; bsel.style.width = ((b - a) * 100) + "%";
        xh.style.left = (fx * 100) + "%"; showXt(fx);
      };
      var endBrush = function (e) {
        if (!brushing) return; brushing = false; bsel.style.display = "none"; xh.style.display = "none"; xt.style.display = "none";
        var rect = brect || chartEl.getBoundingClientRect(), fx = Math.max(0, Math.min(1, (getX(e) - rect.left) / rect.width));
        var a = Math.min(bx0, fx), b = Math.max(bx0, fx);
        if (b - a < 0.04 || !curHist || curHist.length < 4) return;  // toque/clique curto → só mostrou o crosshair, sem zoom
        var n = curHist.length - 1, i0 = Math.round(a * n), i1 = Math.round(b * n);
        if (i1 - i0 < 2) return;
        var includesEnd = i1 >= n;  // janela inclui hoje? mantém o cone de futuro
        var ns = winStart + i0; curHist = s.hist.slice(ns, ns + (i1 - i0) + 1); winStart = ns; paint(curHist, includesEnd); rbtn.style.display = "inline-block";  // janela absoluta → overlays seguem o zoom
      };
      chartEl.style.touchAction = "none";  // o gráfico captura o gesto (toque/arraste) sem rolar a página
      chartEl.addEventListener("mousedown", startBrush); chartEl.addEventListener("mousemove", moveBrush);
      chartEl.addEventListener("mouseup", endBrush); chartEl.addEventListener("mouseleave", endBrush);
      chartEl.addEventListener("touchstart", startBrush, { passive: false }); chartEl.addEventListener("touchmove", moveBrush, { passive: false }); chartEl.addEventListener("touchend", endBrush);
      rbtn.addEventListener("click", function (e) { e.stopPropagation();
        var on = mw.querySelector(".rp-per button.on"); var fr = (on && on.getAttribute("data-m") != null) ? parseFloat(on.getAttribute("data-m")) : 0;
        setChart(isFinite(fr) ? fr : 0);
      });
    }
    for (var pi = 0; pi < perBtns.length; pi++) { (function (btn) {
      btn.addEventListener("click", function (e) { e.stopPropagation();
        if (btn.getAttribute("data-max")) {  // item 6: período TRAVADO (free) → gráfico real BORRADO + lock ancorado. NÃO marca este botão como ativo: senão dblclick(onReset)/sair-do-compare liam o botão travado e liberavam o período pago sem gate.
          if (useUp) {  // canvas perde o bitmap se serializado via innerHTML → move os nós p/ dentro do blur sem re-serializar
            var gate = document.createElement("div"); gate.className = "rp-gate";
            var blur = document.createElement("div"); blur.className = "rp-blur";
            while (chartEl.firstChild) blur.appendChild(chartEl.firstChild);
            gate.appendChild(blur); gate.insertAdjacentHTML("beforeend", lockHTML); chartEl.appendChild(gate);
          } else { chartEl.innerHTML = '<div class="rp-gate"><div class="rp-blur">' + chartEl.innerHTML + '</div>' + lockHTML + '</div>'; }
          return;
        }
        for (var b = 0; b < perBtns.length; b++) perBtns[b].classList.remove("on"); btn.classList.add("on");
        setChart(parseFloat(btn.getAttribute("data-m")));
      });
    })(perBtns[pi]); }
    document.addEventListener("keydown", onkey);  // (appendChild(mw) já feito antes do setChart, p/ o uPlot montar com o modal no DOM)
  }

  function render(node, d, lang, sections, chrome, skin) {
    var L = lang === "en";
    function show(k){ return !sections || sections.indexOf(k) >= 0; }  // data-sections escolhe o que mostrar
    var rr = d.radar || {}, v = d.vertice || {}, h = '<div class="rp' + (skin === "editorial" ? " skin-editorial" : "") + '">';
    // ★ catálogo do estúdio: tudo que é cruzável via /v1/serie, por categoria (cresce sozinho com o digest)
    (function () {
      var cat = [], push = function (c, items) { items = (items || []).filter(Boolean); if (items.length) cat.push({ cat: c, items: items }); };
      push(L ? "Stocks" : "Ações", (rr.tickers_acoes || []).map(function (t) { return { cod: String(t.ticker).toLowerCase(), cls: "equity_br", nome: t.ticker }; }));
      push(L ? "Indices" : "Índices", (rr.indices || []).map(function (x) { return { cod: x.codigo, cls: x.classe, nome: x.nome }; }));
      push(L ? "REITs" : "FIIs", [{ cod: "IFIX", cls: "indice_ms", nome: "IFIX" }].concat((rr.tickers_fiis || []).map(function (t) { return { cod: String(t.ticker).toLowerCase(), cls: "fii", nome: t.ticker }; })));
      push(L ? "Currency" : "Moeda", rr.cambio ? [{ cod: rr.cambio.codigo, cls: "pulso", nome: rr.cambio.nome }] : []);
      push(L ? "Fiscal & macro" : "Fiscal & macro", ((rr.fiscal && rr.fiscal.series) || []).map(function (x) { return { cod: x.cod, cls: x.cls || "macro", nome: x.nome }; }));
      push(L ? "Real estate" : "Imóveis", (rr.imovel_m2 || []).map(function (m) { return { cod: m.cod, cls: m.cls || "macro", nome: m.cidade + " · m²" }; }));
      var imItens = []; (rr.intermercado_br || []).filter(function (x) { return x.cod; }).forEach(function (x) {  // composto + razão (÷) + denominador nativo (ex.: Ouro) — todos cruzáveis/selecionáveis
        imItens.push({ cod: x.cod, cls: "intermercado", nome: x.numn || x.nome });
        imItens.push({ cod: x.cod, cls: "intermercado_ratio", nome: (x.numn || x.nome) + "÷" + (x.denn || "IBOV") });
        if (x.denn && x.denn.toUpperCase() !== "IBOV") imItens.push({ cod: x.cod, cls: "intermercado_den", nome: x.denn });
      });
      push(L ? "Intermarket / sectors" : "Intermercado / setores", imItens);
      push("Cripto", (v.cripto || []).map(function (t) { return { cod: String(t.simbolo).toLowerCase(), cls: "cripto", nome: t.simbolo }; }));
      RP_CAT = cat;
    })();
    // marca translúcida (branding + backlink) — só nos embeds; data-chrome="off" omite (uso na nossa própria página)
    if (chrome) h += '<div class="hd"><a class="brand" href="https://radarperene.com" target="_blank" rel="noopener" aria-label="Radar Perene">' +
      '<svg width="19" height="19" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.3"/><circle cx="16" cy="16" r="7" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.3"/><line x1="16" y1="16" x2="16" y2="3" stroke="var(--_accent)" stroke-width="1.8"/><circle cx="16" cy="16" r="2.2" fill="var(--_accent)"/></svg>' +
      '<span>Radar <b>Perene</b></span></a><span class="sub">' + (L ? "as of " : "ref. ") + esc(d.data_referencia || "-") + '</span></div>';
    function card(k, sc, r) { return '<div class="c"><div class="k">' + esc(k) + '</div><div class="b">' + (sc == null ? "—" : esc(sc)) + '</div><div class="r">' + esc(r) + '</div></div>'; }
    function brain(n, t, exp, first) { return '<div class="brain' + (first ? ' first' : '') + '"><span class="bn">' + n + '</span><span class="bt">' + t + '</span>' + (exp ? '<span class="bx">' + (L ? "experiment" : "experimento") + '</span>' : '') + '</div>'; }
    // selo de vida honesta: frescor + cobertura VIVA — vem do digest (fn SQL cobertura_radar); cresceu no banco → aparece
    // sozinho, sem hardcode (GRAPH §13.5). Fallback = números reais atuais, nunca os antigos inflados.
    var _cob = d.cobertura || {};
    function _humN(n) { if (n == null || !isFinite(n)) return null; if (n >= 1e6) { var m = Math.round(n / 1e5) / 10; return L ? (m + "M") : (String(m).replace(".", ",") + " mi"); } if (n >= 1e3) return Math.round(n / 1e3) + (L ? "K" : " mil"); return String(n); }
    var _ca100 = (_cob.ativos != null && _cob.ativos >= 100) ? Math.floor(_cob.ativos / 100) * 100 : null; // "mais de 100 ativos" (narrativa)
    var covTxt = (L ? "coverage: " : "cobertura: ") +
      (_cob.ativos != null ? _cob.ativos : "112") + (L ? " assets · " : " ativos · ") +
      (_humN(_cob.linhas) || (L ? "490K" : "490 mil")) + (L ? " rows · " : " linhas · ") +
      (_cob.tribunais != null ? _cob.tribunais : "15") + (L ? " courts · since " : " tribunais · desde ") +
      (_cob.desde != null ? _cob.desde : "1970");
    h += '<div class="live"><span class="dot"></span>' + (L ? "updated " : "atualizado em ") + esc(d.data_referencia || "-") + ' · ' + esc(covTxt) + '</div>';

    // ════ CÉREBRO 1 — Radar · 5 lentes (regime regulatório, conservador) ════
    h += brain("Radar", (L ? "5 lenses · regulatory regime" : "5 lentes · regime regulatório"), false, true);
    if (show("regime") && rr.regime) { var g = rr.regime; h += '<h4>' + (L ? "Current signal · regime" : "Sinal atual · regime") + '</h4><div class="legend">' + (L ? "0–100 · 50 ≈ neutral · higher = more risk/pressure" : "0–100 · 50 ≈ neutro · quanto maior, mais risco/pressão") + '</div><div class="g3">' +
      card(L ? "Brazil" : "Brasil", (g.brasil || {}).score, (g.brasil || {}).regime) + card("Global", (g.global || {}).score, (g.global || {}).regime) +
      card(L ? "BR intermarket" : "BR intermercado", (g.br_intermercado || {}).score, (g.br_intermercado || {}).regime) + '</div>';
      if (g.valuation) { var vl = g.valuation; var erpTxt = vl.erp == null ? "" : ((vl.erp >= 0 ? "+" : "") + vl.erp + "pp"); h += '<div class="i valstrip" data-cod="erp_br" data-cls="macro" data-nome="' + esc(L ? "Equity risk premium" : "Prêmio de risco das ações") + '"><div class="vl-l"><span class="vl-t">' + (L ? "Valuation BR · risk premium" : "Valuation BR · prêmio de risco") + '</span><span class="vl-r">' + esc(vl.regime) + '</span></div><div class="vl-b"><span class="vl-s">' + esc(vl.score) + '%</span> <span class="vl-x">' + (L ? "below fair value" : "abaixo do valor-justo") + (vl.n ? " · " + vl.n + (L ? " stocks" : " ações") : "") + (erpTxt ? " · ERP " + erpTxt : "") + '</span></div></div>'; } }
    if (rr.cambio) { h += '<div class="tk" style="margin-top:8px"><span class="i" data-cod="' + esc(rr.cambio.codigo) + '" data-cls="pulso"><span class="sy">' + esc(rr.cambio.nome) + '</span><span class="pr">R$ ' + esc(rr.cambio.valor) + '</span>' + (rr.cambio.var30 != null ? '<span class="mt">' + (rr.cambio.var30 >= 0 ? "+" : "") + esc(rr.cambio.var30) + '% 30d</span>' : '') + '</span></div>'; }
    if (rr.indices && rr.indices.length) { h += '<h4>' + (L ? "Indices · overview" : "Índices · panorama") + '</h4><div class="legend">' + (L ? "click to chart · + more in the app" : "clique pra ver o gráfico · + outros no app") + '</div><div class="tk">' +
      rr.indices.map(function (ix) { return '<span class="i" data-cod="' + esc(ix.codigo) + '" data-cls="' + esc(ix.classe) + '"><span class="sy">' + esc(ix.nome) + '</span><span class="pr">' + esc(ix.valor) + '</span>' + (ix.var12m != null ? '<span class="mt">' + (ix.var12m >= 0 ? "+" : "") + esc(ix.var12m) + '% 12m</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (show("lentes") && rr.lentes && rr.lentes.length) { h += '<h4>' + (L ? "The 5 lenses · today" : "As 5 lentes · hoje") + '</h4><div class="legend">' + (L ? "each lens = a domain of Brazil’s regime; color = intensity · dashed line = projection under current conditions, not a forecast" : "cada lente = um domínio do regime; a cor = intensidade · linha tracejada = projeção sob condições atuais, não previsão") + '</div><div class="lns">' +
      rr.lentes.map(function (l) {
        var buildAm = function (a) {
          if (!a || !a.itens || !a.itens.length) return '';
          return '<div class="mi" style="margin:5px 0 2px"><b>' + esc(a.titulo) + '</b></div><div class="tk">' +
            a.itens.map(function (it) {
              var clk = it.cod ? ' data-cod="' + esc(String(it.cod).toLowerCase()) + '" data-cls="' + esc(it.cls || 'equity_br') + '"' : ' style="cursor:default"';
              return '<span class="i"' + clk + '><span class="sy">' + esc(it.rot) + '</span>' + (it.meta ? '<span class="mt">' + esc(it.meta) + '</span>' : '') + '</span>';
            }).join('') + '</div>' +
            (a.total && a.total > a.itens.length ? '<div class="legend">+ ' + (a.total - a.itens.length) + ' ' + esc(a.nota || (L ? 'in the app' : 'no app')) + '</div>' : '');
        };
        var am = buildAm(l.amostra) + buildAm(l.amostra2);  // amostra2 = grupo extra clicável+cruzável (Macro fiscal/M, Imobiliária custo/crédito)
        var more = (l.desc || l.indicador_desc || am) ? '<div class="more">' + (l.desc ? '<div class="mi">' + (L ? "The lens — " : "A lente — ") + esc(l.desc) + '</div>' : '') + (l.indicador_desc ? '<div class="mi"><b>' + esc(l.indicador) + ':</b> ' + esc(l.indicador_desc) + '</div>' : '') + am + '</div>' : '';
        return '<div class="ln ' + esc(l.tom) + '"' + (more ? ' data-exp="1"' : '') + '><div class="lk">' + esc(l.nome) + (more ? ' <span class="lr" style="opacity:.55">＋</span>' : '') + '</div><div class="li">' + esc(l.indicador) + '</div>' +
        (l.valor != null ? '<div class="lv">' + esc(l.valor) + (l.unidade ? ' <span class="lr">' + esc(l.unidade) + '</span>' : '') + '</div>' : '') +
        '<div class="lr">' + esc(l.leitura || "") + '</div>' + (l.spark ? spark(l.spark) : '') + more + '</div>'; }).join("") + '</div>'; }
    if (show("macro") && rr.macro_essencial && rr.macro_essencial.length) { h += '<h4>' + (L ? "Indicators behind it · macro" : "Indicadores por trás · macro") + '</h4>' +
      '<div class="legend">' + (L ? "the technical drivers behind the lenses — for those who want to go deeper" : "os motores técnicos por trás das lentes — para quem quer ir fundo") + '</div><div>' +
      rr.macro_essencial.map(function (m) { return '<span class="chip">' + (m.valor != null ? '<b>' + esc(m.valor) + '</b> <span class="u">' + esc(m.unidade) + '</span> ' : '') + esc(m.nome) + (m.leitura ? ' <span class="u">· ' + esc(m.leitura) + '</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (show("intermercado") && rr.intermercado_br && rr.intermercado_br.length) { h += '<h4>' + (L ? "Indicators ⇒ BR intermarket" : "Indicadores ⇒ intermercado BR") + '</h4><div class="g3">' +
      rr.intermercado_br.map(function (x) { var hasTk = x.tickers && x.tickers.length, xp = x.fonte || hasTk || (x.leadlag && x.leadlag.txt); return '<div class="t ' + esc(x.tom) + '"' + (xp ? ' data-exp="1"' : '') + '><div class="n">' + esc(x.nome) + (xp ? ' <span class="rr" style="opacity:.55">＋</span>' : '') + '</div><div class="rr" style="margin-top:4px">' + esc(x.leitura) + '</div>' + (x.spark2 && x.spark2.a ? '<div class="legend" style="margin-top:5px"><span style="color:var(--_accent)">▬</span> ' + esc(x.spark2.an) + ' <span style="color:var(--_cool)">▬</span> ' + esc(x.spark2.bn) + (x.spark2.c ? ' <span style="color:var(--_warm)">▦</span> ' + esc(x.spark2.cn) : '') + (x.spark2.ar ? '<span style="opacity:.6;display:block;margin-top:1px">' + (L ? "left axis " : "eixo esq ") + esc(fmtNum(x.spark2.ar[0])) + '–' + esc(fmtNum(x.spark2.ar[1])) + ' · ' + (L ? "right axis " : "eixo dir ") + esc(fmtNum(x.spark2.br[0])) + '–' + esc(fmtNum(x.spark2.br[1])) + '</span>' : '') + '</div>' + dualSpark(x.spark2.a, x.spark2.b, x.spark2.c) : '') + (xp ? '<div class="more">' + (x.fonte ? '<div class="mi">' + (L ? "What it is — " : "O que é — ") + esc(x.fonte) + '</div>' : '') + (x.leadlag && x.leadlag.txt ? '<div class="mi"><b>Lead-lag</b> — ' + esc(x.leadlag.txt) + '</div>' : '') + (hasTk ? '<div class="mi" style="margin-bottom:3px">' + (L ? "components (click):" : "componentes (clique):") + '</div><div class="tk">' + x.tickers.map(function (tk) { return '<span class="i" data-cod="' + esc(String(tk.ticker).toLowerCase()) + '" data-cls="' + esc(tk.cls || "equity_br") + '"><span class="sy">' + esc(tk.ticker) + '</span>' + (tk.dy != null ? '<span class="mt">DY ' + esc(tk.dy) + '%</span>' : '') + '</span>'; }).join("") + '</div>' : '') + (x.cod ? '<button class="rp-imxp" data-cod="' + esc(x.cod) + '" data-nome="' + esc(x.numn || x.nome) + '" data-denn="' + esc(x.denn || "IBOV") + '" data-ll="' + esc((x.leadlag && x.leadlag.txt) || x.fonte || "") + '">⤢ ' + (L ? "compare (lead-lag overlay)" : "comparar (overlay lead-lag)") + '</button>' : '') + '</div>' : '') + '</div>'; }).join("") + '</div>'; }
    // ações: tira diversa 1-por-setor (com relação risk-on/off). Tesouro (M) e FIIs (R) agora vivem DENTRO das lentes (amostra).
    if (show("acoes") && rr.tickers_acoes && rr.tickers_acoes.length) { h += '<h4>' + (L ? "BR stocks · one per sector" : "Ações BR · 1 por setor") + '</h4><div class="legend">' + (L ? "a diverse cut across sectors — click any for the chart; each lens above opens its own curated 5" : "uma tira diversa por setor — clique pra ver o gráfico; cada lente acima abre os 5 dela") + '</div><div class="tk">' +
      rr.tickers_acoes.map(function (t) { var rel = (t.razao_nome ? "∈ " + t.razao_nome + (t.razao_leitura ? " · " + t.razao_leitura : "") : "") + (t.risk ? ((t.razao_nome ? " · " : "") + t.risk) : ""); var fund = (t.pl != null ? "P/L " + t.pl : "") + (t.dy != null ? ((t.pl != null ? " · " : "") + "DY " + t.dy + "%") : "") + (t.roe != null ? " · ROE " + t.roe + "%" : ""); return '<span class="i" data-cod="' + esc(String(t.ticker).toLowerCase()) + '" data-cls="equity_br"' + (rel ? ' data-rel="' + esc(rel) + '"' : '') + (fund ? ' data-fund="' + esc(fund) + '"' : '') + '><span class="sy">' + esc(t.ticker) + '</span><span class="pr">R$ ' + esc(t.preco) + '</span>' + (t.pos52 != null ? '<span class="mt">' + esc(t.pos52) + (L ? "% of 52w range" : "% da faixa 52s") + '</span>' : '') + (t.setor ? '<span class="mt">' + esc(t.setor) + '</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (rr.fiscal && ((rr.fiscal.series && rr.fiscal.series.length) || (rr.fiscal.composicao && rr.fiscal.composicao.length))) {
      h += '<h4>' + (L ? "Fiscal & monetary" : "Fiscal & monetário") + '</h4><div class="legend">' + (L ? "the public accounts behind the regime — debt/GDP, fiscal stress, real rate, Selic; click for the long history" : "as contas públicas por trás do regime — dívida/PIB, stress fiscal, juro real, Selic; clique pra ver a história longa") + '</div>';
      if (rr.fiscal.series && rr.fiscal.series.length) h += '<div class="tk">' + rr.fiscal.series.map(function (x) { return '<span class="i" data-cod="' + esc(x.cod) + '" data-cls="' + esc(x.cls || "macro") + '"><span class="sy">' + esc(x.nome) + '</span><span class="pr">' + esc(x.valor) + (x.unidade ? ' ' + esc(x.unidade) : '') + '</span></span>'; }).join("") + '</div>';
      if (rr.fiscal.composicao && rr.fiscal.composicao.length) {
        h += '<div class="legend" style="margin-top:7px">' + (L ? "Federal public debt by indexer (DPF)" : "Dívida Pública Federal por indexador (DPF)") + '</div><div class="comp">' +
          rr.fiscal.composicao.map(function (c) { return '<span class="seg ' + esc(c.tom || 'neu') + '" style="width:' + c.pct + '%" title="' + esc(c.nome) + ' ' + c.pct + '%"></span>'; }).join("") + '</div><div class="legend">' +
          rr.fiscal.composicao.map(function (c) { return '<span style="white-space:nowrap"><b style="color:var(--_' + esc(c.tom || 'neu') + ')">▮</b> ' + esc(c.nome) + ' ' + c.pct + '%</span>'; }).join(" · ") + '</div>';
      }
    }
    if (rr.imovel_m2 && rr.imovel_m2.length) { h += '<h4>' + (L ? "Real estate · price per m² (FipeZap)" : "Imóveis · custo do m² (FipeZap)") + '</h4><div class="legend">' + (L ? "residential — sale (R$/m²), rent (R$/m²·mo) and gross yield; click for the city's history since 2008" : "residencial — venda (R$/m²), aluguel (R$/m²·mês) e rentabilidade bruta; clique pra ver a história da cidade desde 2008") + '</div><div class="tk">' +
      rr.imovel_m2.map(function (m) { return '<span class="i" data-cod="' + esc(m.cod) + '" data-cls="' + esc(m.cls || "macro") + '"><span class="sy">' + esc(m.cidade) + '</span><span class="pr">R$ ' + esc(m.venda) + (L ? "/m²" : "/m²") + '</span>' + (m.aluguel != null ? '<span class="mt">' + (L ? "rent " : "aluguel ") + 'R$ ' + esc(m.aluguel) + '/m²·' + (L ? "mo" : "mês") + '</span>' : '') + (m.rend != null ? '<span class="mt">' + (L ? "yield " : "rend. ") + esc(m.rend) + '%/' + (L ? "yr" : "ano") + '</span>' : '') + '</span>'; }).join("") + '</div>'; }

    if (rr.tese) { var te = rr.tese, sgs = te.sinais || [], cns = te.cenarios || [];
      var teMore = '<div class="more">' +
        (te.explicacao ? '<div class="mi">' + (L ? "Why — " : "Por que — ") + esc(te.explicacao) + '</div>' : '') +
        (te.mercado ? '<div class="mi"><b>' + (L ? "Market: " : "Mercado: ") + esc(te.mercado) + '</b>' + (te.confianca_mercado ? ' · ' + (L ? "confidence " : "confiança ") + esc(te.confianca_mercado) : '') + ' · ' + esc(te.n_confirma) + (L ? " confirm, " : " confirmam, ") + esc(te.n_contra) + (L ? " contradict" : " contrariam") + (te.evolucao ? ' · ' + esc(te.evolucao) + (L ? " over 3m" : " em 3m") : '') + '</div>' : '') +
        (sgs.length ? '<div class="mi" style="margin-top:4px"><b>' + (L ? "Signals that formed it:" : "Sinais que a formaram:") + '</b></div>' + sgs.map(function (g) { return '<div class="mi">· ' + esc(g.titulo) + (g.orgao ? ' <span style="opacity:.6">(' + esc(g.orgao) + ')</span>' : '') + (g.data ? ' <span style="opacity:.6">' + esc(g.data) + '</span>' : '') + '</div>'; }).join("") : '') +
        (cns.length ? '<div class="mi" style="margin-top:4px"><b>' + (L ? "Scenarios mapped: " : "Cenários mapeados: ") + '</b>' + cns.map(esc).join(" · ") + ' <span style="opacity:.6">' + (L ? "(full in the app)" : "(detalhe no app)") + '</span></div>' : '') + '</div>';
      h += '<h4>' + (L ? "Live thesis · why it was calculated" : "Tese viva · por que foi calculada") + '</h4>' +
        '<div class="ln warm" data-exp="1"><div class="lk">' + esc(te.titulo) + ' <span class="lr" style="opacity:.55">＋</span></div><div class="li">' + (L ? "regulatory · confidence " : "regulatório · confiança ") + esc(te.confianca) + ' · ' + esc(te.n_sinais) + (L ? " signals" : " sinais") + '</div><div class="lr">' + (L ? "click to see the provenance" : "clique pra ver a proveniência") + '</div>' + teMore + '</div>' +
        (rr.teses_total > 1 ? '<div class="legend">+ ' + (rr.teses_total - 1) + (L ? " other active theses in the app" : " outras teses ativas no app") + '</div>' : '');
    }
    if (show("analogo_br") && rr.analogo_br) { var ab = rr.analogo_br; h += '<h4>' + (L ? "BR analog · past → future" : "Análogo BR · passado → futuro") + '</h4><div class="hl"><div class="q">' + esc(ab.pergunta) + '</div>' + (ab.datas_analogas && ab.datas_analogas.length ? '<div class="q" style="margin:-4px 0 8px;color:var(--_accent)">' + (L ? "today resembles " : "hoje lembra ") + esc(ab.datas_analogas.join(" · ")) + '</div>' : '') + '<div class="stat"><div><div class="v">' + (ab.mediana_ret_pct >= 0 ? "+" : "") + esc(ab.mediana_ret_pct) + '%</div><div class="r">' + (L ? "median (IBOV)" : "mediana (IBOV)") + '</div></div><div><div class="v">' + esc(ab.hit_rate_pct) + '%</div><div class="r">hit-rate · n=' + esc(ab.n_analogos) + '</div></div></div>' + (ab.n_analogos && ab.n_analogos < 20 ? '<div class="rp-ml" style="color:var(--_warm);opacity:.9;margin-top:5px">⚠ ' + (L ? "small sample (n=" : "amostra pequena (n=") + esc(ab.n_analogos) + ') · ±' + Math.round(200 * Math.sqrt((ab.hit_rate_pct / 100) * (1 - ab.hit_rate_pct / 100) / ab.n_analogos)) + 'pp — ' + (L ? "wide uncertainty, distribution not a forecast" : "incerteza larga, distribuição não previsão") + '</div>' : '') + '</div>'; }
    if (rr.regime_scatter && rr.regime_scatter.points) { var sct = rr.regime_scatter; var dist = distChart(sct);
      h += '<h4>' + esc(sct.titulo) + '</h4><div class="legend"><span style="color:var(--_accent)">▮</span> ' + (L ? "today's regime band" : "faixa do regime de hoje") + ' · <span style="color:var(--_warm)">●</span> ' + (L ? "up" : "alta") + ' <span style="color:var(--_cool)">●</span> ' + (L ? "down" : "queda") + ' · ' + (L ? "x = regime · y = IBOV next 6m" : "x = regime · y = IBOV em 6m") + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:230px">' + scatterChart(sct) + '<div class="legend" style="margin-top:3px">' + (L ? "the cloud · today highlighted" : "a nuvem · hoje em destaque") + '</div></div>' +
        (dist ? '<div style="flex:1;min-width:230px">' + dist.svg + '<div class="legend" style="margin-top:3px">' + (L ? "outcome distribution · most between " : "distribuição dos desfechos · maioria entre ") + (dist.p25 >= 0 ? "+" : "") + dist.p25 + '% ' + (L ? "and " : "e ") + (dist.p75 >= 0 ? "+" : "") + dist.p75 + '% (' + (L ? "median " : "mediana ") + (dist.p50 >= 0 ? "+" : "") + dist.p50 + '%, n=' + dist.n + ')</div></div>' : '') +
        '</div>' + (sct.leitura ? '<div class="legend" style="margin-top:4px">' + esc(sct.leitura) + '</div>' : ''); }

    // ════ CÉREBRO 2 — Vértice · experimento (cross-asset, hipótese contextual) ════
    h += brain("Vértice", (L ? "cross-asset · contextual hypothesis" : "cross-asset · hipótese contextual"), true, false);
    if (show("termometros") && v.termometros) { var tms = v.termometros.slice().sort(function (p, q) { return Math.abs((q.valor == null ? 50 : q.valor) - 50) - Math.abs((p.valor == null ? 50 : p.valor) - 50); }), tShown = tms.slice(0, 6), tRest = tms.length - tShown.length;
      h += '<h4>' + (L ? "Thermometers · loudest today" : "Termômetros · os mais ativos hoje") + '</h4>' +
      '<div class="legend">' + (L ? "0 = calm · 50 = neutral · 100 = extreme" : "0 = calmo · 50 = neutro · 100 = extremo") + (tRest > 0 ? " · +" + tRest + (L ? " more in the app" : " no app") : "") + '</div><div class="g3">' +
      tShown.map(function (t) { var more = (t.desc || t.comp) ? '<div class="more">' + (t.desc ? '<div class="mi">' + esc(t.desc) + '</div>' : '') + (t.comp ? '<div class="mi"><b>' + (L ? "Composed of — " : "Composto por — ") + '</b>' + esc(t.comp) + '</div>' : '') + '</div>' : '';
        return '<div class="t ' + cls(t.valor) + '"' + (more ? ' data-exp="1"' : '') + '><div class="n">' + esc(t.nome) + (more ? ' <span class="rr" style="opacity:.55">＋</span>' : '') + '</div><div class="v">' + (t.valor == null ? "—" : esc(t.valor)) + '</div><div class="rr">' + esc(t.regime) + '</div>' +
        (t.valor != null ? '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, t.valor)) + '%"></i></div>' : '') + more + '</div>'; }).join("") + '</div>'; }
    if (show("cripto") && v.cripto && v.cripto.length) { h += '<h4>' + (L ? "Crypto · highlights" : "Cripto · destaques") + '</h4>' + (v.cripto_sentimento ? '<div class="legend">Fear &amp; Greed: ' + esc(v.cripto_sentimento.fng) + ' (' + esc(v.cripto_sentimento.leitura) + ')</div>' : '') + (v.cripto_onchain ? '<div class="legend">' + esc(v.cripto_onchain.nota) + ': ' + [v.cripto_onchain.tvl ? 'TVL ' + esc(v.cripto_onchain.tvl) : '', v.cripto_onchain.stablecoin ? 'stablecoins ' + esc(v.cripto_onchain.stablecoin) : '', v.cripto_onchain.ssr != null ? 'SSR ' + esc(v.cripto_onchain.ssr) : ''].filter(Boolean).join(' · ') + '</div>' : '') + '<div class="tk">' +
      v.cripto.map(function (t) { return '<span class="i" data-cod="' + esc(String(t.simbolo).toLowerCase()) + '" data-cls="cripto"><span class="sy">' + esc(t.simbolo) + '</span><span class="pr">$ ' + esc(t.preco) + '</span>' + (t.pos52 != null ? '<span class="mt">' + esc(t.pos52) + (L ? "% of 52w" : "% da faixa 52s") + '</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (show("extras")) { var ex = [];
      if (v.breadth) { if (v.breadth.us) ex.push(card(L ? "US breadth" : "Breadth US", v.breadth.us.valor + "%", v.breadth.us.regime)); if (v.breadth.br) { var br = v.breadth.br; ex.push(card(L ? "BR breadth · % > 200-day MA" : "Breadth BR · % > média 200d", br.valor + "%", (br.leitura || br.regime) + (br.n ? " · " + br.n + (L ? " names" : " papéis") : ""))); } }
      if (v.geo_riskon) ex.push(card(L ? "Geographic risk-on" : "Risk-on geográfico", v.geo_riskon.valor, v.geo_riskon.regime));
      if (ex.length) h += '<h4>' + (L ? "Market breadth / geographic" : "Amplitude de mercado / geográfico") + '</h4>' +
        '<div class="legend">' + (L ? "% of stocks above their 200-day average · geographic = emerging vs developed rotation" : "% de ações acima da média de 200 dias · geográfico = rotação emergentes vs desenvolvidos") + '</div><div class="g3">' + ex.join("") + '</div>' +
        ((v.breadth && v.breadth.br && v.breadth.br.serie && v.breadth.br.serie.length > 1) ? '<div class="legend" style="margin-top:7px">' + (L ? "BR breadth over time · last 36 months (% > 200-day MA)" : "Breadth BR ao longo do tempo · últimos 36 meses (% > média 200d)") + '</div>' + bigChart({ hist: v.breadth.br.serie }) : ''); }
    if (show("leadlag") && v.lead_lag && v.lead_lag.length) { h += '<h4>' + (L ? "Lead-lag · statistically significant (FDR)" : "Lead-lag · com significância (FDR)") + '</h4><ul class="ll">' +
      v.lead_lag.map(function (x) { return '<li><b>' + esc(x.leitura) + '</b> <span class="tag">· ' + esc(x.sentido) + ' · corr ' + esc(x.corr) + ' · ' + esc(x.janela_dias) + 'd · FDR ✓</span></li>'; }).join("") + '</ul>'; }
    if (show("analogo") && v.estudo_analogo) { var a = v.estudo_analogo; h += '<h4>' + (L ? "Analog study · past → future" : "Estudo de análogo · passado → futuro") + '</h4><div class="hl"><div class="q">' + esc(a.pergunta) + '</div>' + (a.datas_analogas && a.datas_analogas.length ? '<div class="q" style="margin:-4px 0 8px;color:var(--_accent)">' + (L ? "today resembles " : "hoje lembra ") + esc(a.datas_analogas.join(" · ")) + '</div>' : '') + '<div class="stat">' +
      '<div><div class="v">' + esc(a.mediana_ret_pct) + '%</div><div class="r">' + (L ? "median" : "mediana") + '</div></div>' +
      '<div><div class="v">' + (a.delta_pp >= 0 ? "+" : "") + esc(a.delta_pp) + 'pp</div><div class="r">vs base ' + esc(a.base_rate_pct) + '%</div></div>' +
      '<div><div class="v">' + esc(a.hit_rate_pct) + '%</div><div class="r">hit-rate · n=' + esc(a.n_analogos) + '</div></div></div>' + (a.n_analogos && a.n_analogos < 20 ? '<div class="rp-ml" style="color:var(--_warm);opacity:.9;margin-top:5px">⚠ ' + (L ? "small sample (n=" : "amostra pequena (n=") + esc(a.n_analogos) + ') · ±' + Math.round(200 * Math.sqrt((a.hit_rate_pct / 100) * (1 - a.hit_rate_pct / 100) / a.n_analogos)) + 'pp — ' + (L ? "wide uncertainty, distribution not a forecast" : "incerteza larga, distribuição não previsão") + '</div>' : '') + '</div>'; }
    if (show("divergencias") && v.divergencias && v.divergencias.length) { h += '<h4>' + (L ? "Divergences today" : "Divergências hoje") + '</h4><ul class="dv">' +
      v.divergencias.map(function (x) { return '<li><b>' + esc(x.codigo) + '</b> · ' + esc(x.leitura) + '</li>'; }).join("") + '</ul>'; }
    // teaser de profundidade — o avançado SENTE que assinando cruza tudo (sem entregar o core)
    if (show("par") && d.par_curado && d.par_curado.serie_a) { var pc = d.par_curado; h += '<h4>' + (L ? "Curated cross · " : "Cruzamento curado · ") + esc(pc.a) + ' × ' + esc(pc.b) + '</h4><div class="legend"><span style="color:var(--_accent)">▬</span> ' + esc(pc.a) + ' · <span style="color:var(--_cool)">▬</span> ' + esc(pc.b) + ' · ' + esc(pc.nota) + '</div>' + dualSpark(pc.serie_a, pc.serie_b) + '<div class="lr" style="margin-top:4px">' + esc(pc.leitura) + ' <span style="color:var(--_dim)">(corr ' + esc(pc.corr) + ')</span></div>'; }
    h += '<div class="teaser"><b>' + (L ? "This is a sample of the engine." : "Esta é uma amostra do motor.") + '</b> ' +
      (L ? ("The full plan adds the provenance of every signal, free cross-analysis of any indicator against any other, historical analogs and projection — across " + (_ca100 ? "over " + _ca100 + " assets" : "over 100 assets") + " and 50+ years of history.")
         : ("O plano completo acrescenta a proveniência de cada sinal, o cruzamento livre de qualquer indicador com qualquer outro, análogos históricos e projeção — sobre " + (_ca100 ? "mais de " + _ca100 + " ativos" : "mais de 100 ativos") + " e 50+ anos de histórico.")) +
      (chrome ? '<br><a href="https://radarperene.com?utm_source=embed&utm_medium=widget" target="_blank" rel="noopener">' + (L ? "See the full app →" : "Ver o app completo →") + '</a>' : '') + '</div>';
    if (chrome) h += '<div class="ft">' + (d.disclaimer ? esc(d.disclaimer[lang] || d.disclaimer.pt) : "") + ' · ' + (L ? "data by" : "dados de") + ' <a href="https://radarperene.com" target="_blank" rel="noopener">Radar Perene</a></div>';
    h += '</div>';
    node.innerHTML = h;
  }

  // ★ modo ATIVO ÚNICO (página /ativo/{ticker}) — gráfico rico inline (cone+valor-justo) + readout honesto + "ampliar & manipular" (openBig).
  // Reusa bigChart/openBig; o embed normal não passa por aqui (aditivo, backlink intacto).
  function renderAtivo(node, codigo, classe, lang, skin) {
    var L = lang === "en", cls = "rp" + (skin === "editorial" ? " skin-editorial" : "");
    node.innerHTML = '<div class="' + cls + '"><div class="sub">' + (L ? "loading…" : "carregando…") + '</div></div>';
    fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(codigo) + "&classe=" + encodeURIComponent(classe), FOPT)
      .then(function (r) { return r.json(); }).then(function (s) {
        var nm = (codigo || "").toUpperCase();
        if (!s || !s.hist || s.hist.length < 2) { node.innerHTML = '<div class="' + cls + '"><div class="sub">' + (L ? "no data for " : "sem dados para ") + esc(nm) + '</div></div>'; return; }
        var gpaid = (window.RP_PREMIUM === true); try { gpaid = gpaid || localStorage.getItem("rp_premium") === "1"; } catch (e) {}
        var useUp = uplotOn() && RP_UP.price;
        var aSel = animaActive(s, "estr", gpaid), aObj = aSel.obj;  // ★ Ânima: free=estrutural, curto=Founder (seletor)
        var animaOk = !!aObj, riscoOk = s.risco && s.risco.serie && s.risco.serie.length > 1;
        var hasStack = useUp && (animaOk || riscoOk);
        var h = '<div class="' + cls + '"><div class="hd"><h4 style="margin:0">' + esc(nm) + '</h4><span class="sub">' + (L ? "descriptive engine · today" : "motor descritivo · hoje") + '</span></div>';
        // ★ COMPONENTE UNIVERSAL: preço → Ânima → Risk-on/off como UMA linha do tempo (âncora "hoje"), crosshair sincronizado entre os 3.
        if (useUp) {
          h += '<div class="rp-chart rp-ativo-price"></div>';
          h += overlayBar(s, lang, gpaid);  // Preço · MM200 · Mediana análoga (free) + P25–P75 · P10–P90 · Bollinger · Valor-justo (Founder)
          if (animaOk) h += animaSelHTML(aSel, lang) + '<div class="rp-ml rp-anima-cap" style="margin-top:9px">' + esc(animaCap(aObj, lang, aSel.mode)) + '</div><div class="rp-osc rp-anima"></div>';
          if (riscoOk) h += '<div class="rp-ml" style="margin-top:7px">' + esc(oscCaption(s.risco, lang, "risk")) + '</div><div class="rp-osc rp-risk"></div>';
        } else {  // SVG (fallback)
          h += '<div>' + bigChart(s, { big: true }) + '</div>';
          if (animaOk) h += '<div class="rp-ml" style="margin-top:9px">' + esc(animaCap(aObj, lang, aSel.mode)) + '</div>' + riskPane(aObj, { big: true });
          if (riscoOk) h += '<div class="rp-ml" style="margin-top:7px">' + esc(oscCaption(s.risco, lang, "risk")) + '</div>' + riskPane(s.risco, { big: true });
        }
        h += oscTextLine(s.hist2, s.hist2_label, lang) + oscTextLine(s.hist3, s.hist3_label, lang);  // domínio (cripto FnG/TVL · ações volume) → texto; pilha empilhada = padrão
        // ★ VALUATION (Lyn Alden) — leitura TEXTUAL p/ FREE (prêmio/desconto vs valor-justo, citável p/ IA/SEO);
        //   a LINHA de valor-justo no gráfico + a investigação (DCF/cenários) ficam no Founder (🔒). Decisão do dono.
        if (s.fair && s.fair.premio_pct != null) { var isFii = s.fair.tipo === "fii";
          h += '<div class="rp-ml" style="margin-top:8px"><b>' + (isFii ? (L ? "Net asset value " : "Valor patrimonial ") : "Valuation · Lyn Alden ") + '</b><b style="color:var(--_warm)">' + (s.fair.premio_pct >= 0 ? "+" : "") + esc(s.fair.premio_pct) + '%</b> ' + (L ? "vs price" : "vs preço") + (isFii ? ' · P/VP ' + esc(s.fair.pvp) : (' · ' + (L ? "P/E " : "P/L ") + esc(s.fair.pe_now) + ' vs ' + esc(s.fair.pe_normal) + (L ? " normal" : " normal"))) + (gpaid ? '' : ' · <span style="opacity:.72"><span style="color:var(--_accent)">🔒</span> ' + (L ? "Lyn Alden valuation line on chart in Founder" : "linha de Valuation (Lyn Alden) no gráfico no Founder") + '</span>') + '</div>'; }
        else if (s.dcf && s.dcf.iv != null) h += '<div class="rp-ml" style="margin-top:8px"><b>' + (L ? "DCF intrinsic " : "DCF intrínseco ") + '</b>R$ ' + esc(s.dcf.iv) + ' · ' + (L ? "price " : "preço ") + '<b style="color:var(--_' + (s.dcf.premio_pct >= 0 ? "warm" : "cool") + ')">' + (s.dcf.premio_pct >= 0 ? "+" : "") + esc(s.dcf.premio_pct) + '%</b>' + (gpaid ? '' : ' · <span style="opacity:.72"><span style="color:var(--_accent)">🔒</span> ' + (L ? "model & scenarios in Founder" : "modelo & cenários no Founder") + '</span>') + '</div>';
        if (s.trend && s.trend.score != null) h += '<div class="rp-ml" style="margin-top:4px">' + (L ? "Trend score " : "Score de tendência ") + '<b>' + esc(s.trend.score) + '/10</b></div>';
        h += analogBlock(s, nm, lang, gpaid);  // taxa-base nobre (P3)
        h += '<div class="rp-ml" style="margin-top:8px;opacity:.7">' + (L ? "descriptive, never a recommendation · distribution, not a forecast" : "descritivo, nunca recomendação · distribuição, não previsão") + '</div>';
        h += '<button class="rp-zoom" type="button" style="margin-top:9px">⤢ ' + (L ? "expand & manipulate" : "ampliar & manipular") + '</button>';
        h += '</div>';
        node.innerHTML = h;
        if (useUp) {
          var SYNC = "rpativo" + (++_syncSeq);
          // osciladores PRIMEIRO, preço POR ÚLTIMO: o link-group de janela propaga a janela do último a setá-la →
          // o preço impõe a janela ~3a a Ânima/risk (senão o autoscale dos osciladores sobrescreveria o período do preço).
          mountStackOsc(node.querySelector(".rp-anima"), node.querySelector(".rp-risk"), s, SYNC, lang, true, aObj, gpaid);
          wireAnima(node, s, lang, gpaid, SYNC, true);  // seletor de horizonte (estrutural↔curto🔒) re-monta no mesmo grupo de sync/janela
          var pEl = node.querySelector(".rp-ativo-price");
          if (pEl) {
            var _navClampA = null;  // FREE: janela navegável permitida (~3a → fim do cone); Founder = null
            var pOpt = { big: true, pro: gpaid, sync: SYNC, lang: lang, hideX: !!hasStack, axisW: 52, nav: true, clamp: function () { return _navClampA; }, sinais: s.sinais };  // free navega COM zoom mas clampado ao tempo permitido; Founder = livre. pinos do buy signal (Índice de Risco Perene)
            var up = window.RPUplot.upPrice(pEl, gateSerie(s, gpaid), pOpt);
            if (up) {
              _upMounted.push({ el: pEl, draw: function (el) { window.RPUplot.upPrice(el, gateSerie(s, gpaid), pOpt); } });  // re-tema
              // abre ancorado no presente (~3 anos recentes); wheel/drag exploram dentro da janela (free clampado, Founder livre)
              if (s.datas && s.datas.length === s.hist.length) {
                var cut = new Date(s.datas[s.datas.length - 1]); cut.setFullYear(cut.getFullYear() - 3); var cs = cut.toISOString().slice(0, 10);
                var i0 = 0; while (i0 < s.datas.length && s.datas[i0] < cs) i0++;
                var toTs = function (d) { var t = Date.parse(String(d).length <= 10 ? d + "T00:00:00Z" : d); return isFinite(t) ? t / 1000 : null; };
                var mn = toTs(s.datas[i0]), xarr = up.data && up.data[0], maxFull = (xarr && xarr.length) ? xarr[xarr.length - 1] : null;
                if (mn != null && maxFull != null && maxFull > mn) {  // inclui o futuro do cone; propaga a janela aos osciladores via link-group
                  _navClampA = gpaid ? null : { min: mn, max: maxFull };  // free: trava a navegação na janela ~3a
                  var _applyWin = function () { try { up.setScale("x", { min: mn, max: maxFull }); } catch (e) {} };
                  _applyWin(); if (typeof requestAnimationFrame === "function") requestAnimationFrame(_applyWin);  // re-aplica APÓS o init deferido (rAF) do uPlot dos osciladores — senão o autoscale deles sobrescreve a janela ~3a
                }
              }
            }
          }
        }
        var zb = node.querySelector(".rp-zoom"); if (zb) zb.addEventListener("click", function () { openBig(s, nm, "", lang, null); });
        node.querySelectorAll(".rp-ob").forEach(function (el) { el.addEventListener("click", function () { openBig(s, nm, "", lang, null); }); });  // overlay (free ou 🔒) → estúdio (manipulação = Founder)
      }).catch(function () { node.innerHTML = '<div class="' + cls + '"><div class="sub">—</div></div>'; });
  }

  // Re-desenha os uPlots montados quando o tema troca claro/escuro (canvas é bitmap, não herda var CSS).
  // MutationObserver no <html> data-theme → zero edição de index.html. Só age com a flag on.
  function rpWatchTheme() {
    if (typeof MutationObserver !== "function") return;
    var mo = new MutationObserver(function () { if (uplotOn()) rpRedrawUplots(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  function boot() {
    injectStyle();
    rpWatchTheme();
    var nodes = document.querySelectorAll("#radar-perene,[data-radar-perene]");
    if (!nodes.length) return;
    ensureUplot(function () { bootNodes(nodes); });
  }
  function bootNodes(nodes) {
    nodes.forEach(function (node) {
      var lang = node.getAttribute("data-lang") === "en" ? "en" : "pt";
      var chrome = node.getAttribute("data-chrome") !== "off";  // "off" = sem marca/teaser-link/rodapé (uso na própria página)
      var sa = node.getAttribute("data-sections");  // ex.: "regime,macro,termometros,analogo" — vazio = tudo
      var sections = sa ? sa.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : null;
      var skin = node.getAttribute("data-skin") === "editorial" ? "editorial" : null;  // "editorial" = preset quiet-luxury (hairlines, números serif leves, paleta contida) p/ embeds premium
      var asset = node.getAttribute("data-asset");  // ★ modo ATIVO ÚNICO (opt-in, p/ páginas /ativo/{ticker}) — embed normal (SEM data-asset) fica IDÊNTICO, não quebra backlink
      if (asset) { renderAtivo(node, asset.trim(), node.getAttribute("data-classe") || "equity_br", lang, skin); return; }
      // clique num ticker → busca série + projeção e expande a sparkline tríade (interação básica por ticker)
      node.addEventListener("click", function (ev) {
        var t = ev.target, chip = null, exp = null, imxp = null;
        while (t && t !== node) { if (t.getAttribute) { if (!chip && t.getAttribute("data-cod")) chip = t; if (!exp && t.getAttribute("data-exp")) exp = t; if (!imxp && ("" + (t.className || "")).indexOf("rp-imxp") >= 0) imxp = t; } t = t.parentNode; }
        if (imxp) {  // ⤢ comparar grande (intermercado) → modal já em compare com o COMPOSTO do setor (numerador) × IBOV
          ev.stopPropagation();
          var icod = imxp.getAttribute("data-cod"), inome = imxp.getAttribute("data-nome") || "Composto", idenn = imxp.getAttribute("data-denn") || "IBOV";
          var ill = imxp.getAttribute("data-ll") || "";  // interpretação lead-lag (risk-on/off) do card → vira legenda no comparativo
          // lead-lag (3 séries do mini-gráfico): numerador + [denominador ≠IBOV (ex. defensivas) OU a RAZÃO ÷IBOV (o sinal)] + IBOV
          var pre = [{ cod: icod, cls: "intermercado", nome: inome }];
          if (idenn && idenn.toUpperCase() !== "IBOV") pre.push({ cod: icod, cls: "intermercado_den", nome: idenn });
          else pre.push({ cod: icod, cls: "intermercado_ratio", nome: inome + "÷IBOV" });  // ÷IBOV: a razão É o sinal lead-lag (faltava)
          pre.push({ cod: "ibov", cls: "pulso", nome: "IBOV" });
          fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(icod) + "&classe=intermercado", FOPT)
            .then(function (r) { return r.json(); }).then(function (s0) { if (s0 && s0.hist && s0.hist.length) openBig(s0, inome, ill, lang, null, pre); }).catch(function () { });
          return;
        }
        if (exp && !chip) { exp.classList.toggle("open"); return; }                 // clique na lente/razão → abre/fecha 2ª camada
        if (!chip || chip.getAttribute("data-open")) return;
        chip.setAttribute("data-open", "1"); chip.style.opacity = ".6";
        var rel = chip.getAttribute("data-rel"), fund = chip.getAttribute("data-fund"), meta = rel || "";
        fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(chip.getAttribute("data-cod")) + "&classe=" + encodeURIComponent(chip.getAttribute("data-cls") || "equity_br"), FOPT)
          .then(function (r) { return r.json(); }).then(function (s) {
            chip.style.opacity = "";
            var box = document.createElement("span"); box.style.cssText = "flex-basis:100%;width:100%;margin-top:4px";
            var inner = "";
            if (s && s.hist && s.hist.length > 1) {
              var _gp = (window.RP_PREMIUM === true); try { _gp = _gp || localStorage.getItem("rp_premium") === "1"; } catch (e) {}  // linha de valor-justo = Founder (free vê só texto)
              inner += '<span class="mt" style="display:block">' + (lang === "en" ? "price · history → today → projection (dashed)" + (_gp && s.fair ? " · gold = fair value" : "") : "preço · histórico → hoje → projeção (tracejada)" + (_gp && s.fair ? " · ouro = valor-justo" : "")) + '</span>' + bigChart({ hist: s.hist, proj: s.proj, cone: s.cone }, { fair: (_gp && s.fair) ? s.fair.serie : null, futFair: (_gp && s.fair) ? s.fair.serie_fut : null });  // bug 5: SÉRIE do fair + cone; fair gated (Founder)
              if (s.fair && s.fair.premio_pct != null) inner += '<span class="mt" style="display:block">' + (lang === "en" ? "fair value " : "valor-justo ") + '<b style="color:var(--_warm)">' + (s.fair.premio_pct >= 0 ? "+" : "") + esc(s.fair.premio_pct) + '%</b> ' + (lang === "en" ? "vs price · P/E now " : "vs preço · P/L hoje ") + esc(s.fair.pe_now) + ' vs ' + esc(s.fair.pe_normal) + (lang === "en" ? " normal" : " normal") + '</span>';
              if (s.dcf && s.dcf.iv != null) inner += '<span class="mt" style="display:block">' + (lang === "en" ? "DCF intrinsic R$ " : "DCF intrínseco R$ ") + esc(s.dcf.iv) + ' · ' + (lang === "en" ? "price " : "preço ") + '<b style="color:var(--_' + (s.dcf.premio_pct >= 0 ? "warm" : "cool") + ')">' + (s.dcf.premio_pct >= 0 ? "+" : "") + esc(s.dcf.premio_pct) + '%</b> · ' + (lang === "en" ? "model, not a forecast" : "modelo, não previsão") + '</span>';
              if (s.risco && s.risco.serie && s.risco.serie.length > 1) inner += '<span class="mt" style="display:block;margin-top:5px">' + (lang === "en" ? "Perene Risk Index · risk-on/off (ticks = past extremes)" : "Índice de Risco Perene · risk-on/off (traços = extremos passados)") + '</span>' + riskPane(s.risco);
              inner += oscTextLine(s.hist2, s.hist2_label, lang) + oscTextLine(s.hist3, s.hist3_label, lang);  // domínio (FnG/TVL/volume) → texto; stack completo no "ampliar"
            }
            var canBig = s && s.hist && s.hist.length > 1;
            if (canBig) inner += '<button class="rp-zoom" type="button">⤢ ' + (lang === "en" ? "expand chart" : "ampliar gráfico") + '</button>';
            inner += '<span class="mt" style="display:block;margin-top:4px">' + (meta ? esc(meta) + ' · ' : '') + (lang === "en" ? "full in the app →" : "completo no app →") + '</span>';
            box.innerHTML = inner; chip.appendChild(box);
            if (canBig) { var zb = box.querySelector(".rp-zoom"); if (zb) zb.addEventListener("click", function (e) { e.stopPropagation(); var syn = chip.querySelector(".sy"); openBig(s, syn ? syn.textContent : (chip.getAttribute("data-cod") || "").toUpperCase(), meta, lang, fund); }); }
          }).catch(function () { chip.style.opacity = ""; chip.removeAttribute("data-open"); });
      });
      fetch(API + "?lang=" + lang, FOPT).then(function (r) { return r.json(); })
        .then(function (d) { render(node, d, lang, sections, chrome, skin); })
        .catch(function () { node.innerHTML = '<div class="rp"><div class="sub">Radar Perene — indisponível.</div></div>'; });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
