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
  // ★ API sob o MESMO domínio (radarperene.com/api/* → Worker → Supabase): edge-cache do /v1/serie anon (~1,14MB,
  //   3,7s→0,2s medido), domínio único, observabilidade. Base = origin do PRÓPRIO radar.js (RP_SRC) → o embed de
  //   terceiros chama de volta radarperene.com/api (não o supabase.co), e .com/.com.br batem cada um no seu worker.
  //   fopt() segue mandando o token do Founder no Authorization → o proxy repassa → moat intacto (Founder recomputa
  //   sem cache; anon compartilha a cache da borda). Auth (supabase-js no host) continua direto no Supabase, fora daqui.
  var RP_ORIGIN = (function () { try { return new URL(RP_SRC).origin; } catch (e) { return (typeof location !== "undefined" ? location.origin : ""); } })();
  var API = RP_ORIGIN + "/api/v1/digest";
  var ESTUDOS_API = RP_ORIGIN + "/api/estudos";  // P3.3 Biblioteca de Estudos (via proxy /api)
  // ★ dedupe do digest: teaser + radar completo (mesma página/idioma) compartilham UMA busca → ~metade do time-to-insight.
  var _digestP = {};
  // ★ time-to-insight: se o worker já inlinou o digest do dia no HTML (window.__RP_DIGEST[lang]), usa-o direto
  //   (0 round-trip ~2-4s — o gargalo real do paint). O /v1/digest é token-agnóstico (o handler ignora o
  //   Authorization), então serve anon e Founder idêntico; o moat segue no /v1/serie (per-token). Sem inline → fetch.
  function _getDigest(lang) {
    if (!_digestP[lang]) {
      var pre = (typeof window !== "undefined" && window.__RP_DIGEST && window.__RP_DIGEST[lang]) ? window.__RP_DIGEST[lang] : null;
      _digestP[lang] = pre ? Promise.resolve(pre) : fetch(API + "?lang=" + lang, fopt()).then(function (r) { return r.json(); });
    }
    return _digestP[lang];
  }
  // anon key pública do Supabase (feita p/ viver no client — vive no bundle de todo site Supabase;
  // o gateway exige um JWT válido, a proteção real é a RLS/função que só expõe o digest curado).
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjanRrZ2x0cnhkbmxhY2V6cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTk3MDQsImV4cCI6MjA5NTc5NTcwNH0.CkEmnGCSTfF-9FjjebyeBUFV0-vW6CsfpyBea6cLCUs";
  // headers da API: anon por padrão; se a página-host expôs o token do assinante (window.RP_TOKEN), manda-o no Authorization →
  // o /v1/serie devolve a DISTRIBUIÇÃO completa dos análogos (Founder). Sem token (free/embed) = teaser. Apikey segue anon (gateway).
  function fopt() { var tk = (typeof window !== "undefined" && window.RP_TOKEN) ? window.RP_TOKEN : ANON; return { headers: { apikey: ANON, Authorization: "Bearer " + tk } }; }
  // ★ LEITOR CANÔNICO do plano (P0#1 single-source-of-truth): TODO gating de UI lê daqui — login (window.RP_PREMIUM, setado pelo
  //   /v1/me no host) OU flag local rp_premium. A página-host também expõe window.RP_TOKEN (= access_token Supabase) p/ o fopt()
  //   destravar os DADOS no /v1/serie. UI (rpIsPro) e dados (RP_TOKEN) saem da MESMA sessão → não divergem mais.
  function rpIsPro() { var p = (typeof window !== "undefined" && window.RP_PREMIUM === true); try { p = p || localStorage.getItem("rp_premium") === "1"; } catch (e) {} return p; }
  var RP_CAT = [];  // catálogo de séries cruzáveis (estúdio) — SEED do digest (~40, render inicial). cresce sozinho com novos tickers
  // ★ Fase 0 — universo COMPLETO (~233, auto-crescente) do /v1/catalog: agrupado por setor/classe. Lazy (1ª vez que o picker abre),
  //   via fopt() (auth → sem 401). Fecha o gap site↔widget: o picker do Estúdio alcança os mesmos ativos que /ativo + sitemap.
  var RP_CAT_FULL = null, RP_CAT_LOADING = false, RP_CAT_WAIT = [];
  function rpEnsureCatalog(lang, cb) {
    if (RP_CAT_FULL) return cb();
    RP_CAT_WAIT.push(cb);
    if (RP_CAT_LOADING) return;
    RP_CAT_LOADING = true;
    fetch(API.replace("/v1/digest", "/v1/catalog") + (lang === "en" ? "?lang=en" : ""), fopt())
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var uni = (d && d.grupos) ? d.grupos.map(function (g) { return { cat: g.cat, items: g.items }; }) : [];
        var SYNTH = { intermercado: 1, intermercado_ratio: 1, intermercado_den: 1, macro: 1 };  // composições intermercado + imóveis/FIPEZAP + fiscal vivem SÓ no digest (fora do universo /v1/tickers) → preserva-as
        // ★ catálogo TOTAL (2026-06-11): o /v1/catalog agora traz imóveis/macro/tesouro — dedupe por cod|cls p/ o
        //   item do digest não aparecer 2x; sobram no digestOnly só composições que o catálogo ainda não tem.
        var seen = {}; uni.forEach(function (g) { g.items.forEach(function (it) { seen[it.cod + "|" + it.cls] = 1; }); });
        var digestOnly = (RP_CAT || []).filter(function (g) { return g.items.some(function (it) { return SYNTH[it.cls]; }); })
          .map(function (g) { return { cat: g.cat, items: g.items.filter(function (it) { return !seen[it.cod + "|" + it.cls]; }) }; })
          .filter(function (g) { return g.items.length; });
        RP_CAT_FULL = uni.length ? uni.concat(digestOnly) : RP_CAT;
        RP_CAT_LOADING = false; var w = RP_CAT_WAIT; RP_CAT_WAIT = []; w.forEach(function (f) { f(); });
      })
      .catch(function () { RP_CAT_LOADING = false; var w = RP_CAT_WAIT; RP_CAT_WAIT = []; w.forEach(function (f) { f(); }); });  // falha → segue com o seed do digest
  }
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
  var RP_UP = { price: true, osc: true, scatter: false, dual: true };  // dual = intermercado lead-lag (upDual: 2 pontas + razão, empilhado c/ Ânima/risk)
  var _syncSeq = 0;  // contador de chaves de sync (1 grupo de crosshair/janela por gráfico empilhado)
  // true só quando a flag pede E a engine carregou (RPUplot.ready()). Senão → SVG (degrada gracioso).
  function uplotOn() { return RP_ENGINE === "uplot" && window.RPUplot && window.RPUplot.ready(); }

  // Carrega vendor/uplot + uplot-charts SÓ se a flag pedir; resolve quando a engine estiver pronta.
  // Flag off → nunca baixa nada (cb imediato). onerror→cb mantém o widget vivo em SVG se o asset falhar.
  // ★ load-once + fila de callbacks: com lazy-load (IO + idle-warm + guard do modal) ensureUplot pode ser
  //   chamado por várias fontes quase juntas → SEM a fila, cada chamada injetaria scripts duplicados (uPlot 2×).
  var _upLoading = false, _upQueue = [];
  function ensureUplot(cb) {
    if (RP_ENGINE !== "uplot") return cb();                  // flag off → caminho legado, zero download
    if (window.RPUplot && window.RPUplot.ready()) return cb();
    _upQueue.push(cb);
    if (_upLoading) return;                                  // load já em voo → só enfileira (não re-injeta)
    _upLoading = true;
    var base = (RP_SRC || "radar.js").replace(/radar\.js(\?.*)?$/, "");  // src absoluto (capturado no topo) → vendor carrega de radarperene.com/vendor/ em qq página/embed, não relativo a /ativo/…
    function load(tag, attr, url, onload) { var e = document.createElement(tag); e[attr] = url; if (tag === "link") e.rel = "stylesheet"; e.onload = onload; e.onerror = onload; (document.head || document.body).appendChild(e); }
    load("link", "href", base + "vendor/uplot/uPlot.min.css");
    load("script", "src", base + "vendor/uplot/uPlot.iife.min.js", function () {
      load("script", "src", base + "uplot-charts.js", function () {   // engine só depois do vendor
        _upLoading = false; var q = _upQueue.splice(0); for (var i = 0; i < q.length; i++) { try { q[i](); } catch (e) {} }
      });
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
    { id: "fair",  kind: "core", defaultOn: true,  available: function (s) { return !!s.fair; }, label: function (c) { return "Valuation"; } },  // default ON (Founder): o valor-justo (Lyn Alden: lucro × P/L normal) — passado + projeção futura — é diferencial do tier 149; ver preço vs justo "bom/ruim". Free continua só TEXTO (ov.fair forçado false). Decisão do dono (reverte 41b3468; valuation > prominência do cone).
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
      ".rp .c{background:var(--_card);border:1px solid var(--_cardb);border-radius:9px;padding:11px;min-height:74px}" +  // P2#7: piso de altura → linhas uniformes mesmo quando quebram p/ a 2ª fileira
      ".rp .rp-mtog{margin-top:8px;font-size:11px;background:transparent;border:1px solid var(--_line);color:var(--_dim);border-radius:7px;padding:5px 11px;cursor:pointer}.rp .rp-mtog:hover{color:var(--_txt);border-color:var(--_cardb)}.rp .rp-ov{margin-top:8px}" +
      ".rp .rp-tier2{display:flex;align-items:center;gap:11px;margin:30px 0 6px;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--_dim);font-weight:600}.rp .rp-tier2::before,.rp .rp-tier2::after{content:'';flex:1;height:1px;background:var(--_line)}" +  // camada 2: separa o primário (regime/lentes/tese) dos indicadores de apoio
      ".rp .rp-cmpbtn{font-size:11.5px;background:var(--_card2);border:1px solid var(--_line);color:var(--_txt);border-radius:8px;padding:6px 11px;cursor:pointer;margin:0 6px 6px 0;white-space:nowrap}.rp .rp-cmpbtn:hover{border-color:var(--_accent);color:var(--_accent)}" +  // P3.1 → 1C: pares-preset, agora na aba Comparações do drawer (.rp-cmprow saiu com o muro da home)
      ".rp-cmp2{max-width:940px}.rp-cmp2 .rp-cmpgrid{display:grid;grid-template-columns:1fr 1fr;gap:22px}.rp-cmp2 .rp-cmpcol{min-width:0}.rp-cmp2 .rp-mt2{font-family:var(--rp-serif,Georgia,serif);font-size:16px;font-weight:600;margin-bottom:5px;color:var(--_txt)}.rp-cmp2 .rp-cmpchart{margin:4px 0 2px}" +
      ".rp-cmptbl{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:4px}.rp-cmptbl th,.rp-cmptbl td{padding:6px 9px;border-bottom:1px solid var(--_line);text-align:right}.rp-cmptbl th:first-child,.rp-cmptbl td:first-child{text-align:left;color:var(--_dim)}.rp-cmptbl td.win{color:var(--_warm);font-weight:700}" +
      "@media(max-width:640px){.rp-cmp2 .rp-cmpgrid{grid-template-columns:1fr;gap:14px}}" +
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
      ".rp .ln{background:var(--_card2);border:1px solid var(--_line);border-left:3px solid var(--_neu);border-radius:8px;padding:9px;min-height:78px}" +  // P2#7: piso de altura das lentes
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
      ".rp-mc .rp-mt{font-weight:700;font-size:15px;margin:0 28px 2px 0}.rp-mc .rp-ml{font-size:10.5px;color:var(--_dim);margin:5px 0 0;line-height:1.4}.rp-mc .bc.big{height:150px}@media(max-width:600px){.rp-mw{padding:5px}.rp-mc{padding:13px 13px 12px!important;max-height:94vh}.rp-mc .rp-mt{font-size:13.5px;margin-right:26px}.rp-mc .rp-ml{font-size:9.8px;margin-top:4px}.rp-mc .bc.big{height:124px}.rp-mc .rp-per{gap:6px}.rp-mc .rp-per button{padding:11px 13px;font-size:11px}.rp-mc .rp-x,.rp-dc .rp-x{padding:12px 14px;top:0;right:0}.rp-mc .rp-ob,.rp-mc .rp-asel{padding:10px 12px!important}.rp .rp-explore{padding:12px 16px;font-size:13.5px}}" +  // B4 (QA mobile): alvos de toque ≥40px no celular (chips 25px / × 27px / toggles 19px reprovaram); desktop intacto
      ".rp-mc .rp-strip{display:flex;gap:9px 20px;flex-wrap:wrap;margin-top:4px}.rp-mc .rp-st{display:flex;flex-direction:column;min-width:34px;font-family:var(--rp-mono,ui-monospace,monospace)}.rp-mc .rp-st b{font-size:13px;line-height:1.15;white-space:nowrap}.rp-mc .rp-st span{font-size:9px;color:var(--_dim);margin-top:1px}" +
      ".rp-mc .rp-rc{display:grid;grid-template-columns:repeat(auto-fit,minmax(56px,1fr));gap:6px;margin-top:5px}.rp-mc .rp-rcard{background:var(--_card2);border:1px solid var(--_line);border-radius:8px;padding:8px 5px;text-align:center;min-height:46px;display:flex;flex-direction:column;justify-content:center}.rp-mc .rp-rcard b{display:block;font-size:13.5px;line-height:1.1;white-space:nowrap;font-family:var(--rp-mono,ui-monospace,monospace)}.rp-mc .rp-rcard span{display:block;font-size:8.5px;color:var(--_dim);margin-top:3px;letter-spacing:.02em;text-transform:uppercase}" +
      ".rp-mc .rp-52{position:relative;height:6px;background:var(--_card2);border:1px solid var(--_line);border-radius:4px;margin-top:4px}.rp-mc .rp-52 i{position:absolute;top:-2px;width:3px;height:10px;background:var(--_accent);border-radius:2px;transform:translateX(-50%)}" +
      ".rp-mc .rp-per{display:flex;gap:5px;margin:7px 0 3px;flex-wrap:wrap}.rp-mc .rp-per button{border:1px solid var(--_line);background:var(--_card2);color:var(--_dim);border-radius:6px;font-size:10px;padding:3px 10px;cursor:pointer;font-family:var(--rp-font,'Inter',system-ui,sans-serif)}.rp-mc .rp-per button.on{border-color:var(--_accent);color:var(--_accent)}.rp-mc .rp-per button.lock{color:var(--_accent);font-weight:600}" +
      ".rp-mc .rp-lock{border:1px dashed var(--_accent);border-radius:10px;padding:18px 16px;text-align:center;background:var(--_card2);min-height:120px;display:flex;flex-direction:column;justify-content:center}.rp-mc .rp-lock b{display:block;font-size:13px;margin-bottom:5px;color:var(--_txt)}.rp-mc .rp-lock small{font-size:10.5px;color:var(--_dim);line-height:1.5}.rp-mc .rp-lock .cta{display:inline-block;margin-top:11px;background:var(--_accent);color:#fff;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;text-decoration:none}.rp-mc .rp-lock .rp-anchor{display:block;margin-top:9px;font-size:10.5px;font-style:normal;color:var(--_warm);opacity:.92}.rp-mc .rp-gate{position:relative}.rp-mc .rp-gate .rp-blur{filter:blur(7px) saturate(.6);opacity:.5;pointer-events:none;user-select:none}.rp-mc .rp-gate .rp-lock{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:90%;width:340px;box-shadow:0 10px 34px rgba(0,0,0,.45)}" +
      ".rp-mc .rp-chart{position:relative;min-height:200px}" +  // P1#4/#6: reserva a altura do gráfico → não colapsa→expande enquanto o uPlot monta (sem pulo na abertura/troca de período)
      ".rp-mc .rp-xh{position:absolute;top:0;bottom:16px;width:1px;background:var(--_accent);opacity:.55;pointer-events:none;transform:translateX(-0.5px)}.rp-mc .rp-xt{position:absolute;top:0;transform:translateX(-50%);background:var(--_accent);color:#fff;font-size:9px;font-family:var(--rp-mono,ui-monospace,monospace);padding:1px 5px;border-radius:3px;pointer-events:none;white-space:nowrap}.rp-mc .rp-yax{position:absolute;top:0;left:0;right:0;bottom:16px;pointer-events:none}.rp-mc .rp-yl{position:absolute;right:3px;transform:translateY(-50%);font-family:var(--_mono);font-size:9.5px;font-weight:600;color:var(--_txt);background:var(--_card2);padding:0 3px;border-radius:2px;opacity:.95;letter-spacing:-.2px;font-feature-settings:'tnum';box-shadow:0 0 0 1px var(--_line)}.rp-mc .rp-bsel{position:absolute;top:0;bottom:16px;background:var(--_accent);opacity:.14;pointer-events:none;border-left:1px solid var(--_accent);border-right:1px solid var(--_accent)}.rp-mc .rp-reset{margin-top:6px;font-family:var(--_mono);font-size:10px;background:var(--_card2);border:1px solid var(--_line);color:var(--_dim);border-radius:5px;padding:3px 9px;cursor:pointer}" +
      // ── Fase 1: drawer "Explorar" (slide-in direita / bottom-sheet no mobile). z-index 10 ABAIXO do .rp-mw (modal empilha por cima).
      ".rp-dw{position:fixed;inset:0;z-index:2147483590;background:rgba(8,10,14,0);transition:background .22s ease;display:flex;justify-content:flex-end}" +
      ".rp-dw.rp-open{background:rgba(8,10,14,.5)}" +
      ".rp-dc{position:relative;background:var(--_bg);border-left:1px solid var(--_line);width:min(480px,92vw);max-width:480px;height:100%;overflow:auto;padding:18px 18px 26px;box-shadow:-18px 0 60px rgba(0,0,0,.32);transform:translateX(100%);transition:transform .22s cubic-bezier(.22,.61,.36,1);font-family:var(--_font);cursor:default}" +
      ".rp-dw.rp-open .rp-dc{transform:translateX(0)}" +
      ".rp-dc .rp-x{position:absolute;top:9px;right:12px;border:0;background:transparent;color:var(--_dim);font-size:23px;line-height:1;cursor:pointer;padding:2px 6px}.rp-dc .rp-x:hover{color:var(--_accent)}" +
      ".rp-dc .rp-dt{font-weight:700;font-size:15px;margin:0 28px 10px 0}" +
      ".rp-dc .rp-dtab{display:flex;gap:2px;flex-wrap:wrap;border-bottom:1px solid var(--_line);margin-bottom:11px}" +
      ".rp-dc .rp-dtb{font-size:12px;background:transparent;border:0;border-bottom:2px solid transparent;color:var(--_dim);padding:5px 9px;margin-bottom:-1px;cursor:pointer;font-family:var(--_font)}" +
      ".rp-dc .rp-dtb:hover{color:var(--_txt)}.rp-dc .rp-dtb.on{color:var(--_accent);border-bottom-color:var(--_accent);font-weight:700}" +
      ".rp-dc .rp-dbody{font-size:12px;color:var(--_txt)}" +
      "@media(max-width:600px){.rp-dw{justify-content:stretch;align-items:flex-end}.rp-dc{width:100%;max-width:100%;height:auto;max-height:90vh;border-left:0;border-top:1px solid var(--_line);transform:translateY(100%);box-shadow:0 -18px 60px rgba(0,0,0,.32)}.rp-dw.rp-open .rp-dc{transform:translateY(0)}}" +
      // Fase 1B: porta discreta "Explorar →" (não é menu) + grade da aba Mercados dentro do drawer
      ".rp .rp-explore{display:inline-flex;align-items:center;gap:6px;margin:4px 0 10px;font-size:12.5px;font-weight:600;color:var(--_txt);background:var(--_card2);border:1px solid var(--_line);border-radius:8px;cursor:pointer;padding:8px 14px;font-family:var(--_font)}.rp .rp-explore .a{color:var(--_accent);transition:transform .15s}.rp .rp-explore:hover{border-color:var(--_accent);color:var(--_accent)}.rp .rp-explore:hover .a{transform:translateX(3px)}" +  // 2026-06-11: porta deixou de parecer texto (dono demorou a achar) — botão delicado, seta em destaque
      ".rp-dc .rp-mks{display:block;width:100%;box-sizing:border-box;margin:0 0 10px;padding:9px 12px;font:12.5px var(--_font);color:var(--_txt);background:var(--_card2);border:1px solid var(--_line);border-radius:8px;outline:none}.rp-dc .rp-mks:focus{border-color:var(--_accent)}.rp-dc .rp-mks::placeholder{color:var(--_dim)}" +  // busca da aba Mercados (fricção nº 11 da rodada)
      ".rp-dc .rp-mkix{display:flex;flex-wrap:wrap;gap:4px 6px;margin:0 0 12px}.rp-dc .rp-mki{font-family:var(--_mono);font-size:10px;color:var(--_dim);background:transparent;border:1px solid var(--_line);border-radius:6px;padding:4px 8px;cursor:pointer}.rp-dc .rp-mki b{color:var(--_txt);font-weight:600}.rp-dc .rp-mki:hover{border-color:var(--_accent);color:var(--_accent)}.rp-dc .rp-mki:hover b{color:var(--_accent)}" +  // counts-forward: índice nome·contagem → ancora no grupo (sem accordion)
      ".rp-dc .rp-mkg{margin-bottom:13px}.rp-dc .rp-mkh{font-size:11px;color:var(--_dim);font-weight:700;margin-bottom:5px}.rp-dc .rp-mkt-row{display:flex;gap:5px;flex-wrap:wrap}" +
      ".rp-dc .rp-mkt{font-family:var(--_mono);font-size:11px;background:var(--_card2);border:1px solid var(--_line);color:var(--_txt);border-radius:6px;padding:4px 9px;cursor:pointer;transition:border-color .12s,color .12s}.rp-dc .rp-mkt:hover{border-color:var(--_accent);color:var(--_accent)}" +
      ".rp .rp-portas{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px}.rp .rp-portas .rp-explore{margin:0}" +  // Fase 1C: as portas da camada 2 lado a lado (mercados · comparações · estudos)
      ".rp-dc .rp-slotrow{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.rp-dc .rp-slot{font-size:12.5px;background:var(--_card2);border:1px dashed var(--_line);color:var(--_dim);border-radius:8px;padding:9px 14px;cursor:pointer;font-family:var(--_font)}.rp-dc .rp-slot.filled{border-style:solid;color:var(--_txt);font-weight:600}.rp-dc .rp-slot.on,.rp-dc .rp-slot:hover{border-color:var(--_accent);color:var(--_accent)}" +  // 1C: slots [ativo]×[ativo]
      ".rp-dc .rp-cmpgo{font-size:12.5px;font-weight:700;background:var(--_card2);border:1px solid var(--_accent);color:var(--_accent);border-radius:8px;padding:9px 15px;cursor:pointer;font-family:var(--_font)}.rp-dc .rp-cmpgo:disabled{border-color:var(--_line);color:var(--_dim);opacity:.55;cursor:default}" +
      ".rp-dc .rp-pkbox2{margin-top:10px;max-height:300px;overflow:auto;border:1px solid var(--_line);border-radius:8px;padding:10px;background:var(--_card)}" +  // picker do slot: rola por dentro (a folha do drawer continua escaneável)
      "@media(max-width:600px){.rp-dc .rp-slot,.rp-dc .rp-cmpgo{padding:12px 15px}}" +  // B4: alvo de toque ≥40px no celular

      "@media(max-width:520px){.rp{padding:15px}.rp h4{margin:13px 0 6px}.rp .brain{margin-top:16px}}";
    document.head.appendChild(s);
  }

  // ── trava de scroll do modal (P0/P1/P2): congela a página atrás do modal (sem 2ª área de rolagem),
  //    compensa a largura da barra de rolagem (evita o "pulo" lateral ao abrir) e devolve o foco ao
  //    gatilho ao fechar (preserva contexto). overflow:hidden no body MANTÉM o scrollTop atual. Refcount
  //    p/ modais sobrepostos (ex.: comparar aberto a partir do gráfico grande): só destrava o último.
  var _mLock = { n: 0, ov: "", pr: "", focus: null };
  function lockScroll() {
    if (_mLock.n++ > 0) return;  // já travado por outro modal acima
    var de = document.documentElement, b = document.body;
    _mLock.focus = document.activeElement;  // gatilho que abriu → foco volta p/ cá no close
    var sbw = window.innerWidth - de.clientWidth;  // largura da barra que vai sumir com overflow:hidden
    _mLock.ov = b.style.overflow; _mLock.pr = b.style.paddingRight;
    b.style.overflow = "hidden";
    if (sbw > 0) b.style.paddingRight = ((parseFloat(getComputedStyle(b).paddingRight) || 0) + sbw) + "px";  // compensação → sem reflow lateral
  }
  function unlockScroll() {
    if (_mLock.n <= 0 || --_mLock.n > 0) return;  // ainda há modal aberto acima
    var b = document.body;
    b.style.overflow = _mLock.ov; b.style.paddingRight = _mLock.pr;
    try { if (_mLock.focus && _mLock.focus.focus) _mLock.focus.focus(); } catch (e) {}
  }
  // ── modal de "carregando" enquanto a engine uPlot baixa (lazy-load): o clique abre JÁ um shell com
  //    "Carregando gráfico…" (mesma trava de scroll, sem 2ª rolagem) → quando a engine pronta, fecha e
  //    abre o gráfico rico. Nunca degrada p/ SVG. Clicar fora OU Esc cancela (ref.cancelled → não reabre).
  function rpLoadingModal(lang) {
    var L = lang === "en";
    var mw = document.createElement("div"); mw.className = "rp-mw";
    mw.innerHTML = '<div class="rp rp-mc" role="dialog" aria-modal="true" aria-busy="true"><div class="rp-ml" style="padding:34px 12px;text-align:center;opacity:.82">' + (L ? "Loading chart…" : "Carregando gráfico…") + '</div></div>';
    var ref = { cancelled: false };
    function close() { if (!mw.parentNode) return; mw.parentNode.removeChild(mw); document.removeEventListener("keydown", onkey); unlockScroll(); }
    function onkey(e) { if (e.key === "Escape") { ref.cancelled = true; close(); } }
    mw.addEventListener("click", function (e) { if (e.target === mw) { ref.cancelled = true; close(); } });
    document.addEventListener("keydown", onkey);
    lockScroll(); document.body.appendChild(mw);
    ref.close = close;
    return ref;
  }
  // ── teardown dos uPlots de um modal ao fechar (achado nº1: sem isto, preço+Ânima+risco vazavam — instância +
  //    ResizeObserver + entrada no grupo de sync + closures da série — a cada abre/fecha). RPUplot.destroy = clear(el)
  //    desliga o RO, tira do _links e destrói. `.rp-chart` = preço/dual · `.rp-osc` = Ânima e risco empilhados.
  function rpTeardownCharts(root) {
    if (!root || !window.RPUplot || !window.RPUplot.destroy) return;
    var els = root.querySelectorAll(".rp-chart, .rp-osc");
    for (var i = 0; i < els.length; i++) { try { window.RPUplot.destroy(els[i]); } catch (e) {} }
    // ★ achado nº2: também remove do registro de re-tema (_upMounted) as entradas deste modal. Sem isto, _upMounted
    //   retém o nó do gráfico e, via a árvore DESTACADA (parentNode/childNodes), o MODAL INTEIRO a cada abre/fecha
    //   (~189 nós + ~19 listeners/ciclo). O prune lazy (linha ~87) só roda no toggle de tema; aqui libera JÁ no fechar.
    for (var j = _upMounted.length - 1; j >= 0; j--) { var mEl = _upMounted[j].el; if (!mEl || root.contains(mEl) || !mEl.isConnected) _upMounted.splice(j, 1); }
  }

  // ── Fase 1: UM drawer "Explorar" com abas (Mercados/Comparações/Estudos/Termômetros). Espelha o ciclo dos modais
  //    (lockScroll/unlockScroll/rpTeardownCharts/_upMounted). z-index 10 ABAIXO do .rp-mw → openBig aberto de dentro
  //    do drawer empilha por cima. Lazy por aba (build na 1ª ativação, cacheado). Abas registradas pelos sub-steps.
  var RP_TABS = [];  // { key, lpt, len, build(pane, ctx) } — ctx = { close, lang, registerChart(el, draw) }
  function rpRegisterTab(key, lpt, len, build) { if (!RP_TABS.some(function (t) { return t.key === key; })) RP_TABS.push({ key: key, lpt: lpt, len: len, build: build }); }
  function rpOpenExplorar(lang, initialTab) {
    if (!RP_TABS.length) return null;  // inerte enquanto nenhuma aba estiver registrada (1A entrega o shell sem abas)
    var L = lang === "en";
    var dw = document.createElement("div"); dw.className = "rp-dw";
    var tabs = RP_TABS.map(function (t) { return '<button class="rp-dtb" data-tab="' + esc(t.key) + '" role="tab">' + esc(L ? t.len : t.lpt) + '</button>'; }).join("");
    dw.innerHTML = '<div class="rp rp-dc" role="dialog" aria-modal="true" aria-label="' + (L ? "Explore" : "Explorar") + '">'
      + '<button class="rp-x" aria-label="' + (L ? "Close" : "Fechar") + '">×</button>'
      + '<div class="rp-dt">' + (L ? "Explore" : "Explorar") + '</div>'
      + (RP_TABS.length > 1 ? '<div class="rp-dtab" role="tablist">' + tabs + '</div>' : '')
      + '<div class="rp-dbody"></div></div>';
    var body = dw.querySelector(".rp-dbody"), built = {};
    function onkey(e) { if (e.key === "Escape" && !document.querySelector(".rp-mw")) close(); }  // modal/loading (.rp-mw) empilhado por cima → o Esc é dele (o listener do drawer registra ANTES e dispararia junto); o drawer fecha só no próximo Esc
    function close() { if (!dw.parentNode) return; rpTeardownCharts(dw); dw.classList.remove("rp-open"); document.removeEventListener("keydown", onkey); setTimeout(function () { if (dw.parentNode) dw.parentNode.removeChild(dw); }, 220); unlockScroll(); }  // remove o nó após a transição de saída (~220ms); ref-count do lockScroll permite aninhar drawer→modal
    var ctx = { close: close, lang: lang, registerChart: function (el, draw) { _upMounted.push({ el: el, draw: draw }); } };
    function showTab(key) {
      var t = RP_TABS.filter(function (x) { return x.key === key; })[0] || RP_TABS[0];
      dw.querySelectorAll(".rp-dtb").forEach(function (b) { var on = b.getAttribute("data-tab") === t.key; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
      if (!built[t.key]) { var pane = document.createElement("div"); pane.className = "rp-dpane"; body.appendChild(pane); built[t.key] = pane; try { t.build(pane, ctx); } catch (e) { pane.innerHTML = '<div class="rp-ml" style="opacity:.7">—</div>'; } }  // build lazy + cacheado
      for (var k in built) if (built.hasOwnProperty(k)) built[k].style.display = (k === t.key) ? "" : "none";
    }
    dw.addEventListener("click", function (e) {
      var t = e.target;
      if (t === dw) { close(); return; }                                  // backdrop
      if (t.getAttribute && t.className === "rp-x") { close(); return; }    // ×
      var tb = t.getAttribute && t.getAttribute("data-tab"); if (tb) showTab(tb);  // troca de aba (sem refetch — cacheado)
    });
    document.addEventListener("keydown", onkey);
    lockScroll(); document.body.appendChild(dw);
    requestAnimationFrame(function () { requestAnimationFrame(function () { dw.classList.add("rp-open"); }); });  // double-rAF: pinta o transform inicial antes de animar a entrada
    showTab(initialTab || RP_TABS[0].key);
    return { close: close };
  }
  // aba "Mercados": o universo completo do /v1/catalog (RP_CAT_FULL — mesmo do picker do Estúdio), por setor/classe.
  //   Clique = abre o gráfico rico (openBig) ACIMA do drawer. Caminho moat-safe: fopt() no fetch, gating no openBig.
  function rpBuildMercados(pane, ctx) {
    var L = ctx.lang === "en";
    pane.innerHTML = '<div class="rp-ml" style="opacity:.7">' + (L ? "Loading the market universe…" : "Carregando o universo de mercado…") + '</div>';
    rpEnsureCatalog(ctx.lang, function () {
      var src = (RP_CAT_FULL && RP_CAT_FULL.length) ? RP_CAT_FULL : RP_CAT;
      if (!src.length) { pane.innerHTML = '<div class="rp-ml" style="opacity:.7">' + (L ? "catalog unavailable" : "catálogo indisponível") + '</div>'; return; }
      pane.innerHTML = '<div class="rp-ml" style="opacity:.72;margin-bottom:8px">' + (L ? "Every series the Radar tracks, by sector and class — click any for its chart, analogs and projection." : "Todas as séries que o Radar acompanha, por setor e classe — clique em qualquer uma para o gráfico, análogos e projeção.") + '</div>' +
        '<input class="rp-mks" type="search" autocomplete="off" placeholder="' + (L ? "Search asset (name or ticker)…" : "Buscar ativo (nome ou código)…") + '" aria-label="' + (L ? "Search asset" : "Buscar ativo") + '">' +
        // ★ counts-forward (decisão do dono pós-rodada): linha-ÍNDICE com nome · contagem de cada grupo; clique ancora
        //   no grupo. Escaneável SEM accordion (guardrail) — a lista inteira continua renderizada abaixo.
        '<div class="rp-mkix">' + src.map(function (g, i) { return '<button type="button" class="rp-mki" data-gi="' + i + '">' + esc(g.cat) + ' <b>' + g.items.length + '</b></button>'; }).join("") + '</div>' +
        '<div class="rp-mks-none rp-ml" style="display:none;opacity:.7;margin:8px 0">' + (L ? "no asset matches the search" : "nenhum ativo corresponde à busca") + '</div>' +
        src.map(function (g) { return '<div class="rp-mkg"><div class="rp-mkh">' + esc(g.cat) + ' <span style="opacity:.55;font-weight:400">· ' + g.items.length + '</span></div><div class="rp-mkt-row">' + g.items.map(function (it) { return '<button class="rp-mkt" data-cod="' + esc(it.cod) + '" data-cls="' + esc(it.cls) + '" data-nome="' + esc(it.nome) + '">' + esc(it.nome) + '</button>'; }).join("") + '</div></div>'; }).join("");
      pane.querySelectorAll(".rp-mki").forEach(function (b) {
        b.addEventListener("click", function () { var i = parseInt(b.getAttribute("data-gi"), 10); var gEl = pane.querySelectorAll(".rp-mkg")[i]; if (gEl) gEl.scrollIntoView({ behavior: "smooth", block: "start" }); });
      });
      // busca local (fricção nº 11 da rodada 50 personas: "drawer sem busca interna"): filtra nome+código,
      // acento-insensível; grupo sem resultado some. Sem fetch — opera sobre o catálogo já montado.
      var inp = pane.querySelector(".rp-mks"), noneEl = pane.querySelector(".rp-mks-none");
      var norm = function (s) { s = String(s || "").toLowerCase(); try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) {} return s; };
      if (inp) inp.addEventListener("input", function () {
        var toks = norm(inp.value).split(/\s+/).filter(Boolean), any = false;  // multi-palavra: TODOS os tokens, em qualquer ordem ("são paulo venda" acha "São Paulo · venda m²")
        pane.querySelectorAll(".rp-mkg").forEach(function (gEl, gi) {
          var vis = 0;
          gEl.querySelectorAll(".rp-mkt").forEach(function (b) {
            var hay = norm(b.getAttribute("data-nome")) + " " + norm(b.getAttribute("data-cod")) + " " + norm((gEl.querySelector(".rp-mkh") || {}).textContent || "");
            var hit = !toks.length || toks.every(function (t) { return hay.indexOf(t) >= 0; });
            b.style.display = hit ? "" : "none"; if (hit) vis++;
          });
          gEl.style.display = vis ? "" : "none"; if (vis) any = true;
          var ix = pane.querySelectorAll(".rp-mki")[gi]; if (ix) ix.style.display = vis ? "" : "none";  // índice acompanha a busca
        });
        if (noneEl) noneEl.style.display = any ? "none" : "";
      });
    });
    pane.addEventListener("click", function (e) {
      var t = e.target; if (!t || !t.getAttribute || ("" + (t.className || "")).indexOf("rp-mkt") < 0) return;
      var cod = t.getAttribute("data-cod"), cls = t.getAttribute("data-cls"), nome = t.getAttribute("data-nome");
      if (!cod) return; t.style.opacity = ".5";
      var pend = rpLoadingModal(ctx.lang);  // feedback imediato: "Carregando gráfico…" (séries grandes levam ~2s; o chip esmaecido sozinho não bastava). Backdrop cancela.
      fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(cod) + "&classe=" + encodeURIComponent(cls), fopt())
        .then(function (r) { return r.json(); }).then(function (s) {
          t.style.opacity = ""; pend.close(); if (pend.cancelled) return;  // usuário fechou o loading enquanto carregava → não abre
          if (s && s.hist && s.hist.length) openBig(s, nome, "", ctx.lang, null);
        })
        .catch(function () { t.style.opacity = ""; pend.close(); });
    });
  }
  rpRegisterTab("mercados", "Mercados", "Markets", rpBuildMercados);

  // ── aba "Comparações" (Fase 1C): 2 slots do universo COMPLETO (picker com busca, mesmo /v1/catalog do Mercados)
  //    + os pares mais usados → compareTwo (modal empilha por cima do drawer, mesmo ciclo do openBig do Mercados).
  //    Os presets .rp-cmpbtn SAÍRAM da home (compressão); aqui é a casa deles.
  function rpBuildComparacoes(pane, ctx) {
    var L = ctx.lang === "en";
    var CMP = [
      ["petr4", "equity_br", "PETR4", "vale3", "equity_br", "VALE3"],
      ["sp500", "equity_us", "S&P 500", "nasdaq", "equity_index", "Nasdaq"],
      ["btc", "cripto", "Bitcoin", "gold", "commodity", L ? "Gold" : "Ouro"],
      ["ifix", "indice_ms", "IFIX", "ibov", "pulso", "IBOV"],
      ["dxy", "fx", L ? "US Dollar (DXY)" : "Dólar (DXY)", "gold", "commodity", L ? "Gold" : "Ouro"],
      ["itub4", "equity_br", "ITUB4", "bbdc4", "equity_br", "BBDC4"],
    ];
    var sel = [null, null], picking = -1;
    var norm = function (s) { s = String(s || "").toLowerCase(); try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) {} return s; };
    function slotBtn(i) { var c = sel[i]; return '<button type="button" class="rp-slot' + (picking === i ? " on" : "") + (c ? " filled" : "") + '" data-slot="' + i + '">' + (c ? esc(c.nome) : (L ? "choose asset ⌄" : "escolher ativo ⌄")) + '</button>'; }
    function paint() {
      pane.innerHTML = '<div class="rp-ml" style="opacity:.72;margin-bottom:10px">' + (L ? "Two assets side by side — charts, analog cones, returns and precedents. Descriptive, never a recommendation." : "Dois ativos lado a lado — gráficos, cones de análogos, retornos e precedentes. Descritivo, nunca recomendação.") + '</div>'
        + '<div class="rp-slotrow">' + slotBtn(0) + '<span class="rp-ml">×</span>' + slotBtn(1) + '<button type="button" class="rp-cmpgo"' + (sel[0] && sel[1] ? "" : " disabled") + '>' + (L ? "Compare →" : "Comparar →") + '</button></div>'
        + '<div class="rp-pkslot"></div>'
        + '<div class="rp-ml" style="font-weight:700;margin-top:16px">' + (L ? "Most used pairs" : "Pares mais usados") + '</div>'
        + '<div class="rp-mkt-row" style="margin-top:7px">' + CMP.map(function (p) { return '<button type="button" class="rp-cmpbtn" data-a="' + esc(p[0]) + '" data-acls="' + esc(p[1]) + '" data-an="' + esc(p[2]) + '" data-b="' + esc(p[3]) + '" data-bcls="' + esc(p[4]) + '" data-bn="' + esc(p[5]) + '">' + esc(p[2]) + ' × ' + esc(p[5]) + '</button>'; }).join("") + '</div>';
      if (picking >= 0) {
        var box = pane.querySelector(".rp-pkslot");
        box.innerHTML = '<div class="rp-pkbox2"><input class="rp-mks" type="search" autocomplete="off" placeholder="' + (L ? "Search asset (name or ticker)…" : "Buscar ativo (nome ou código)…") + '" aria-label="' + (L ? "Search asset" : "Buscar ativo") + '"><div class="rp-pklist rp-ml" style="opacity:.7">' + (L ? "Loading the universe…" : "Carregando o universo…") + '</div></div>';
        rpEnsureCatalog(ctx.lang, function () {
          var list = box.querySelector(".rp-pklist"); if (!list) return;  // usuário já fechou/trocou o slot
          var src = (RP_CAT_FULL && RP_CAT_FULL.length) ? RP_CAT_FULL : RP_CAT;
          list.style.opacity = ""; list.innerHTML = src.map(function (g) { return '<div class="rp-mkg"><div class="rp-mkh">' + esc(g.cat) + '</div><div class="rp-mkt-row">' + g.items.map(function (it) { return '<button type="button" class="rp-mkt" data-cod="' + esc(it.cod) + '" data-cls="' + esc(it.cls) + '" data-nome="' + esc(it.nome) + '">' + esc(it.nome) + '</button>'; }).join("") + '</div></div>'; }).join("");
          var inp = box.querySelector(".rp-mks");
          if (inp) { inp.addEventListener("input", function () {
            var toks = norm(inp.value).split(/\s+/).filter(Boolean);
            list.querySelectorAll(".rp-mkg").forEach(function (gEl) { var vis = 0;
              gEl.querySelectorAll(".rp-mkt").forEach(function (b) { var hay = norm(b.getAttribute("data-nome")) + " " + norm(b.getAttribute("data-cod")) + " " + norm((gEl.querySelector(".rp-mkh") || {}).textContent || ""); var hit = !toks.length || toks.every(function (tk) { return hay.indexOf(tk) >= 0; }); b.style.display = hit ? "" : "none"; if (hit) vis++; });
              gEl.style.display = vis ? "" : "none"; });
          }); inp.focus(); }
        });
      }
    }
    pane.addEventListener("click", function (e) {
      var t = e.target, slot = null, go = null, pk = null, pre = null;
      while (t && t !== pane) { if (t.getAttribute) { var cn = "" + (t.className || ""); if (!slot && t.getAttribute("data-slot") != null) slot = t; if (!go && cn.indexOf("rp-cmpgo") >= 0) go = t; if (!pk && cn.indexOf("rp-mkt") >= 0 && cn.indexOf("rp-mkt-row") < 0) pk = t; if (!pre && cn.indexOf("rp-cmpbtn") >= 0) pre = t; } t = t.parentNode; }  // slot pelo ATRIBUTO (a classe casaria com o container .rp-slotrow ao subir a árvore)
      if (pk && picking >= 0) { sel[picking] = { cod: pk.getAttribute("data-cod"), cls: pk.getAttribute("data-cls"), nome: pk.getAttribute("data-nome") }; picking = (picking === 0 && !sel[1]) ? 1 : -1; paint(); return; }  // escolheu o A → picker já pula pro B (fluxo de 2 toques)
      if (slot) { var i = parseInt(slot.getAttribute("data-slot"), 10); picking = (picking === i) ? -1 : i; paint(); return; }
      if (go && sel[0] && sel[1]) { compareTwo(sel[0], sel[1], ctx.lang); return; }
      if (pre) { compareTwo({ cod: pre.getAttribute("data-a"), cls: pre.getAttribute("data-acls"), nome: pre.getAttribute("data-an") }, { cod: pre.getAttribute("data-b"), cls: pre.getAttribute("data-bcls"), nome: pre.getAttribute("data-bn") }, ctx.lang); return; }
    });
    paint();
  }
  rpRegisterTab("comparacoes", "Comparações", "Compare", rpBuildComparacoes);

  // ── aba "Estudos" (Fase 1C): o catálogo REAL da Biblioteca (edge /estudos — mesma fonte do modal openEstudo),
  //    com busca + populares, agrupado por família. Os .rp-estbtn saíram da home; fallback = os 8 presets de sempre.
  function rpBuildEstudos(pane, ctx) {
    var L = ctx.lang === "en";
    var POP = [["regime-risk-on-extremo", L ? "Risk-on extreme" : "Risk-on extremo"], ["liquidez-dolar-caro", L ? "Strong dollar" : "Dólar caro"], ["juros-ciclo-queda", L ? "Cutting cycle" : "Selic ciclo de queda"]];
    var FALLBACK = [
      ["regime-risk-on-extremo", L ? "Risk-on extreme" : "Risk-on extremo"], ["regime-risk-off-extremo", L ? "Risk-off extreme" : "Risk-off extremo"],
      ["sentimento-pessimismo-extremo", L ? "Extreme pessimism" : "Pessimismo extremo"], ["sentimento-otimismo-extremo", L ? "Extreme optimism" : "Otimismo extremo"],
      ["liquidez-dolar-caro", L ? "Strong dollar" : "Dólar caro"], ["liquidez-dolar-barato", L ? "Weak dollar" : "Dólar barato"],
      ["juros-ciclo-alta", L ? "Hiking cycle" : "Selic ciclo de alta"], ["juros-ciclo-queda", L ? "Cutting cycle" : "Selic ciclo de queda"],
    ];
    var norm = function (s) { s = String(s || "").toLowerCase(); try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) {} return s; };
    var intro = '<div class="rp-ml" style="opacity:.72;margin-bottom:10px">' + (L ? "What historically happened next when…? Empirical IBOV distribution under each condition — descriptive, never a forecast." : "O que historicamente aconteceu depois quando…? Distribuição empírica do IBOV sob cada condição — descritivo, nunca previsão.") + '</div>';
    var btn = function (chave, nome, def, pronto) { return '<button type="button" class="rp-mkt rp-estu" data-key="' + esc(chave) + '" data-nome="' + esc(nome) + '"' + (def ? ' title="' + esc(def) + '"' : '') + (pronto === false ? ' style="opacity:.55"' : '') + '>' + esc(nome) + (pronto === false ? ' · ' + (L ? "soon" : "em breve") : '') + '</button>'; };
    function paintFlat(pairs) { pane.innerHTML = intro + '<div class="rp-mkt-row">' + pairs.map(function (p) { return btn(p[0], p[1], null, true); }).join("") + '</div>'; }
    pane.innerHTML = '<div class="rp-ml" style="opacity:.7">' + (L ? "Loading the study library…" : "Carregando a biblioteca de estudos…") + '</div>';
    fetch(ESTUDOS_API + "?lang=" + (L ? "en" : "pt"), fopt()).then(function (r) { return r.json(); }).then(function (d) {
      var fams = (d && d.familias) || [];
      if (!fams.length) { paintFlat(FALLBACK); return; }
      pane.innerHTML = intro
        + '<input class="rp-mks" type="search" autocomplete="off" placeholder="' + (L ? "Search study (condition, family)…" : "Buscar estudo (condição, família)…") + '" aria-label="' + (L ? "Search study" : "Buscar estudo") + '">'
        + '<div class="rp-ml" style="font-weight:700;margin:0 0 6px">' + (L ? "Popular" : "Populares") + '</div><div class="rp-mkt-row rp-estpop" style="margin-bottom:13px">' + POP.map(function (p) { return btn(p[0], p[1], null, true); }).join("") + '</div>'
        + '<div class="rp-mks-none rp-ml" style="display:none;opacity:.7;margin:8px 0">' + (L ? "no study matches the search" : "nenhum estudo corresponde à busca") + '</div>'
        + fams.map(function (g) { return '<div class="rp-mkg"><div class="rp-mkh">' + esc(g.familia) + ' <span style="opacity:.55;font-weight:400">· ' + g.estudos.length + '</span></div><div class="rp-mkt-row">' + g.estudos.map(function (es) { return btn(es.chave, es.nome, es.definicao, es.status === "pronto"); }).join("") + '</div></div>'; }).join("");
      var inp = pane.querySelector(".rp-mks"), noneEl = pane.querySelector(".rp-mks-none");
      if (inp) inp.addEventListener("input", function () {
        var toks = norm(inp.value).split(/\s+/).filter(Boolean), any = false;
        pane.querySelectorAll(".rp-mkg").forEach(function (gEl) { var vis = 0;
          gEl.querySelectorAll(".rp-estu").forEach(function (b) { var hay = norm(b.getAttribute("data-nome")) + " " + norm(b.getAttribute("data-key")) + " " + norm(b.getAttribute("title")) + " " + norm((gEl.querySelector(".rp-mkh") || {}).textContent || ""); var hit = !toks.length || toks.every(function (tk) { return hay.indexOf(tk) >= 0; }); b.style.display = hit ? "" : "none"; if (hit) vis++; });
          gEl.style.display = vis ? "" : "none"; if (vis) any = true; });
        if (noneEl) noneEl.style.display = any ? "none" : "";
      });
    }).catch(function () { paintFlat(FALLBACK); });
    pane.addEventListener("click", function (e) {
      var t = e.target; while (t && t !== pane && !(t.getAttribute && t.getAttribute("data-key"))) t = t.parentNode;
      if (t && t !== pane) openEstudo(t.getAttribute("data-key"), t.getAttribute("data-nome"), ctx.lang);
    });
  }
  rpRegisterTab("estudos", "Estudos", "Studies", rpBuildEstudos);

  // ── aba "Termômetros" (Fase 1D): a lista COMPLETA do digest (a home mantém top-3 +3 recolhidos), com descrição
  //    e composição ABERTAS — no drawer a folha é escaneável de uma vez, sem a 2ª camada de toggle da home.
  function rpBuildTermometros(pane, ctx) {
    var L = ctx.lang === "en";
    pane.innerHTML = '<div class="rp-ml" style="opacity:.7">' + (L ? "Loading…" : "Carregando…") + '</div>';
    _getDigest(ctx.lang).then(function (d) {
      var tms = (((d || {}).vertice || {}).termometros || []).slice().sort(function (p, q) { return Math.abs((q.valor == null ? 50 : q.valor) - 50) - Math.abs((p.valor == null ? 50 : p.valor) - 50); });
      if (!tms.length) { pane.innerHTML = '<div class="rp-ml" style="opacity:.7">' + (L ? "thermometers unavailable" : "termômetros indisponíveis") + '</div>'; return; }
      pane.innerHTML = '<div class="rp-ml" style="opacity:.72;margin-bottom:10px">' + (L ? "All " + tms.length + " thermometers · 0 = calm · 50 = neutral · 100 = extreme · sorted by today's distance from neutral." : "Todos os " + tms.length + " termômetros · 0 = calmo · 50 = neutro · 100 = extremo · do mais ao menos distante do neutro hoje.") + '</div><div class="g3">'
        + tms.map(function (t) { return '<div class="t ' + cls(t.valor) + '"><div class="n">' + esc(t.nome) + '</div><div class="v">' + (t.valor == null ? "—" : esc(t.valor)) + '</div><div class="rr">' + esc(t.regime) + '</div>' + (t.valor != null ? '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, t.valor)) + '%"></i></div>' : '') + (t.desc ? '<div class="rr" style="margin-top:5px">' + esc(t.desc) + '</div>' : '') + (t.comp ? '<div class="rr" style="margin-top:4px;opacity:.75"><b>' + (L ? "Composed of — " : "Composto por — ") + '</b>' + esc(t.comp) + '</div>' : '') + '</div>'; }).join("") + '</div>';
    }).catch(function () { pane.innerHTML = '<div class="rp-ml" style="opacity:.7">—</div>'; });
  }
  rpRegisterTab("termometros", "Termômetros", "Thermometers", rpBuildTermometros);

  function esc(x) { return String(x == null ? "" : x).replace(/[<>&"']/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&#34;", "'": "&#39;" }[c]; }); }  // escapa aspas também: ~30 sinks usam esc() DENTRO de atributos (data-nome="…", data-ll="…") — sem isto um " em valor de DB/feed/LLM quebra o atributo (attribute-injection XSS). Entidades renderizam idênticas em texto → zero regressão visual.
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
    if (cone) { if (pro && (cone.lo2 || cone.lo)) all = all.concat((cone.lo2 || cone.lo).slice(1), (cone.hi2 || cone.hi).slice(1)); else all = all.concat(cone.mid.slice(1)); }  // free/gateado: range só até a mediana; pro c/ bandas: até p10–p90
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
    if (cone && pro && cone.lo && cone.hi && opt.cone !== false) { // cone assimétrico (estilo Cowen) — SÓ assinante COM as bandas na data (gateado=null → cai p/ a mediana); toggle via opt.cone
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
  // ★ cadeado SEMPRE clicável → checkout (religado 2026-06-11: o gate do MAX morreu quando os períodos viraram livres
  //   e os 🔒 restantes ficaram inertes — cadeado que não leva à compra é vitrine trancada sem porta).
  function lockA(L, inner) { return '<a href="' + checkoutURL(L ? "en" : "pt") + '" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;cursor:pointer" title="' + (L ? "Unlock with Founder" : "Destravar com o Founder") + '">' + inner + '</a>'; }
  // ★ embed domain-aware (briefing: separar .com / .com.br). Sem override explícito (data-market), a ORIGEM do próprio radar.js (RP_SRC) revela o mercado → backlink/atribuição vão p/ o domínio certo, mesmo num site terceiro.
  function detectMarketFromSrc() { var m = (RP_SRC || "").match(/radarperene\.com(\.br)?/i); return m ? (m[1] ? "br" : "us") : ""; }
  function rpMarket(market, lang) { market = ("" + (market || "")).toLowerCase(); if (market === "br" || market === "us") return market; var d = detectMarketFromSrc(); if (d) return d; return lang === "en" ? "us" : "br"; }
  function rpBacklink(market, lang) { return "https://" + (rpMarket(market, lang) === "us" ? "radarperene.com" : "radarperene.com.br"); }
  // presets do briefing → conjunto de seções (data-sections). widget="regime-br" etc. é açúcar declarativo.
  // ★ Fase 2 (camadas formais, PLANO_COMPRESSAO §1/§5): "editorial" = Camada 1 (o que importa hoje — inferência);
  //   "exploracao" = Camada 2 (de onde isso vem — dados de apoio + portas do drawer). Partição limpa:
  //   editorial ∪ exploracao = o radar completo (sections=null). "tese" e "portas" são chaves novas de seção.
  var RP_WIDGETS = { "regime-br": "lentes,tese,macro,intermercado,acoes", "panorama": "lentes,intermercado,divergencias", "lentes": "lentes", "lenses": "lentes", "termometros": "termometros", "thermometers": "termometros", "global": "termometros,cripto,extras,leadlag,analogo,divergencias", "cripto": "cripto", "crypto": "cripto",
    "editorial": "regime,lentes,tese,analogo_br,scatter,termometros,leadlag,analogo,divergencias,par",
    "exploracao": "indices,intermercado,fiscal,cripto,extras,portas", "exploration": "indices,intermercado,fiscal,cripto,extras,portas" };
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
  function oscCaption(rk, lang, kind, isBR) {
    var L = lang === "en", v = null;
    if (rk && rk.serie) for (var i = rk.serie.length - 1; i >= 0; i--) if (rk.serie[i] != null) { v = rk.serie[i]; break; }
    var pos = v == null ? "—" : v >= 70 ? (L ? "elevated" : "elevado") : v <= 30 ? (L ? "low" : "baixo") : Math.abs(v - 50) <= 8 ? (L ? "near neutral" : "próximo de neutro") : v > 50 ? (L ? "above neutral" : "acima do neutro") : (L ? "below neutral" : "abaixo do neutro");
    if (kind === "anima") return (L ? "Ânima Index · BR market mood: " : "Índice Ânima · humor do mercado BR: ") + pos + (L ? " · extremes = greed/fear" : " · extremos = ganância/medo");
    // ★ ativo GLOBAL (mercado_br===false) → risco GLOBAL (não "Perene/BR"); ativo BR (ou dado antigo sem a flag) → Índice de Risco Perene (marca própria, didático)
    if (isBR === false) return (L ? "Global risk-on/off · risk appetite: " : "Risco global · risk-on/off · apetite ao risco mundial: ") + pos + (L ? " · ticks mark past extremes" : " · traços marcam extremos passados");
    return (L ? "Perene Risk Index · risk appetite: " : "Índice de Risco Perene · apetite ao risco: ") + pos + (L ? " · ticks mark past extremes" : " · traços marcam extremos passados");
  }
  // rótulo CURTO de estado (Camada 4 "Leitura rápida") a partir do último valor 0–100 de um índice (Ânima/Risco).
  function rkPos(rk, L) {
    var v = null; if (rk && rk.serie) for (var i = rk.serie.length - 1; i >= 0; i--) if (rk.serie[i] != null) { v = rk.serie[i]; break; }
    return v == null ? "—" : v >= 70 ? (L ? "elevated" : "elevado") : v <= 30 ? (L ? "low" : "baixo") : Math.abs(v - 50) <= 8 ? (L ? "near neutral" : "próximo de neutro") : v > 50 ? (L ? "above neutral" : "acima do neutro") : (L ? "below neutral" : "abaixo do neutro");
  }
  // barra de overlays (P2): Preço · MM200 · Mediana análoga (free) + P25–P75 · P10–P90 · Bollinger · Valor-justo (Founder, com 🔒). Clique → openBig.
  function overlayBar(s, lang, pro) {
    var L = lang === "en", chips = [{ on: true, lock: false, lbl: serieDiff(s) || (s.stats && s.stats.is_asset === false) ? (L ? "Series" : "Série") : (L ? "Price" : "Preço") }];  // 1E p2: IPCA/curva não é "preço"
    if (s.ma200 && s.ma200.length) chips.push({ on: true, lock: false, lbl: "MM200" });
    if (s.cone) chips.push({ on: true, lock: false, lbl: L ? "Analog median" : "Mediana análoga" });
    if (s.cone && (s.cone.lo || s.cone.lo2)) { chips.push({ on: pro, lock: !pro, lbl: "P25–P75" }); chips.push({ on: pro, lock: !pro, lbl: "P10–P90" }); }
    chips.push({ on: false, lock: !pro, lbl: "Bollinger" });
    if (s.fair) chips.push({ on: pro, lock: !pro, lbl: "Valuation" });
    return '<div class="rp-obar" style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:7px">' + chips.map(function (c) {
      var st = c.lock ? "background:transparent;border:1px dashed var(--_line);color:var(--_dim);opacity:.85" : c.on ? "background:var(--_accent);border:1px solid var(--_accent);color:var(--_card)" : "background:var(--_card2);border:1px solid var(--_line);color:var(--_dim)";
      return '<button class="rp-ob" type="button" style="font-family:var(--_mono);font-size:10px;border-radius:6px;padding:3px 9px;cursor:pointer;' + st + '">' + (c.lock ? "🔒 " : c.on ? "● " : "○ ") + esc(c.lbl) + '</button>';
    }).join("") + '</div>';
  }
  // bloco-análogo NOBRE (P3): a taxa-base como resumo do ativo, não como gráfico solto. Free=3m; Founder=3/6/12m.
  function analogBlock(s, nm, lang, pro) {
    var br = s.base_rate; if (!br) return "";  // aceita teaser ({n,classificacao}) OU forma completa (h[])
    var L = lang === "en";
    if (!pro || !analogHasDist(br)) return analogFreeHTML(br, L);  // ★ free OU data gateada pela API = teaser (moat); Founder = completo
    var HS = ["3m", "6m", "12m"];
    var U = brUnit(br);  // 1E p2: série diff → mediana/faixa em pp (variação do nível), não % (retorno)
    var sgn = function (x) { return (x == null || !isFinite(x)) ? "—" : (x >= 0 ? "+" : "") + (U === "pp" ? Math.round(x * 100) / 100 : Math.round(x * 10) / 10) + U; };
    var rows = HS.map(function (hk) {
      var d = br.h[hk]; if (!d) return "";
      var lab = hk === "3m" ? (L ? "3 months" : "3 meses") : hk === "6m" ? (L ? "6 months" : "6 meses") : (L ? "12 months" : "12 meses");
      var thin = (d.n == null || d.n < 8);
      return '<div style="margin-top:' + (hk === "3m" ? 0 : 9) + 'px"><div class="rp-ml" style="opacity:.7">' + esc(nm) + ' — ' + (L ? "similar regimes in " : "regimes semelhantes em ") + esc(lab) + '</div>'
        + '<div style="font-family:var(--_mono);margin-top:2px;line-height:1.5">'
        + (d.hit != null ? '<b style="color:var(--_' + (d.hit >= 50 ? "warm" : "cool") + ')">' + (L ? "Rose in " : "Subiu em ") + Math.round(d.hit) + '%</b>' + (L ? " of cases" : " dos casos") : '')
        + (d.mediana != null ? ' · ' + (L ? "median " : "mediana ") + '<b>' + sgn(d.mediana) + '</b>' : '')
        + (d.p25 != null && d.p75 != null ? ' · ' + (L ? "range " : "faixa ") + sgn(d.p25) + ' ' + (L ? "to" : "a") + ' ' + sgn(d.p75) : '')
        + (d.n != null ? ' · <span style="opacity:.7">' + d.n.toLocaleString(L ? "en-US" : "pt-BR") + (L ? " analog cases" : " casos análogos") + (d.n_efetivo != null ? (L ? " · effective n " : " · n efetivo ") + d.n_efetivo : "") + (thin ? (L ? " (limited)" : " (limitada)") : "") + '</span>' : '')
        + '</div></div>';
    }).join("");
    return '<div class="rp-analog" style="margin-top:10px;border:1px solid var(--_line);border-radius:9px;padding:10px 12px;background:var(--_card2)">'
      + '<div class="rp-ml" style="font-weight:700;letter-spacing:.03em">' + (L ? "SIMILAR HISTORICAL CASES" : "CASOS HISTÓRICOS SEMELHANTES") + '</div>' + rows
      + (!pro ? '<div class="rp-ml" style="margin-top:8px;opacity:.85">' + lockA(L, '<span style="color:var(--_accent)">🔒</span> ' + (L ? "6m & 12m horizons in Founder" : "horizontes 6m e 12m no Founder")) + '</div>' : '')
      + '<div class="rp-ml" style="margin-top:5px;opacity:.6">' + (L ? "empirical distribution of past outcomes — never a forecast" : "distribuição empírica de desfechos passados — nunca previsão") + '</div></div>';
  }
  // ★ MOAT — bloco-análogo no FREE = só TEASER (existência + nº de casos + leitura qualitativa); a DISTRIBUIÇÃO (probabilidade
  //   de alta · retorno mediano · faixa · 3/6/12m) é o que se vende no Founder. Doutrina (dono + CANONICO_TIER_FREE §moat):
  //   "Free = onde estamos; Founder = o que aconteceu depois". Vende-se a CONCLUSÃO, não a planilha. Per-ativo NUNCA mostra o número
  //   (o macro/diário mostra a mediana do IBOV como gancho — esse é o único análogo numérico livre, e é de propósito).
  function analogFreeHTML(br, L) {
    if (!br) return "";
    // aceita as DUAS formas: TEASER da API gated ({n, classificacao, suficiente}) OU a forma completa (h[].n/mediana) — Founder recebe full.
    var N = (br.n != null) ? br.n : null, medSign = null;
    if (br.h) { var hs = ["3m", "6m", "12m"]; for (var i = 0; i < hs.length; i++) { var d = br.h[hs[i]]; if (d) { if (d.n != null && (N == null || d.n > N)) N = d.n; if (medSign == null && d.mediana != null) medSign = d.mediana; } } }
    if (N == null) return "";  // sem casos → não mostra (degrada honesto)
    var biasLab = function (k) { return k === "alta" ? (L ? "historically leaned up" : "viés histórico de alta") : k === "baixa" ? (L ? "historically leaned down" : "viés histórico de baixa") : (L ? "historically neutral" : "viés histórico neutro"); };
    var bias = br.classificacao ? biasLab(br.classificacao) : (medSign == null ? null : biasLab(medSign > 2 ? "alta" : medSign < -2 ? "baixa" : "neutro"));
    var suf = (br.suficiente != null) ? br.suficiente : (N >= 8), src = (br.fonte === "knn") ? (L ? "k-NN analogs" : "análogos k-NN") : (L ? "broad base" : "base ampla");
    var ck = checkoutURL(L ? "en" : "pt");
    return '<div class="rp-analog" style="margin-top:10px;border:1px solid var(--_line);border-radius:9px;padding:10px 12px;background:var(--_card2)">'
      + '<div class="rp-ml" style="font-weight:700;letter-spacing:.03em">' + (L ? "SIMILAR HISTORICAL CASES" : "CASOS HISTÓRICOS SEMELHANTES") + ' <span style="opacity:.55;font-weight:400">(' + src + ')</span></div>'
      + '<div class="rp-ml" style="margin-top:5px;color:var(--_txt)"><b style="font-family:var(--_mono)">' + N.toLocaleString(L ? "en-US" : "pt-BR") + '</b> ' + (L ? "analogous cases found" : "casos análogos encontrados") + '</div>'
      + '<div class="rp-ml" style="opacity:.85">' + (suf ? (L ? "✓ enough for analysis" : "✓ amostra suficiente para análise") : (L ? "· limited sample" : "· amostra limitada")) + (bias ? ' · ' + (L ? "reading: " : "leitura: ") + bias : '') + '</div>'
      + '<div class="rp-ml" style="margin-top:8px;opacity:.95">' + lockA(L, '<span style="color:var(--_accent)">🔒</span> ' + (L ? "probability of rising · median return · case range (50% / 80%) · 3 / 6 / 12 months" : "probabilidade de alta · retorno mediano · faixa dos casos (50% / 80%) · 3 / 6 / 12 meses")) + '</div>'
      + '<a href="' + ck + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:var(--_accent);text-decoration:none">' + (L ? "What historically happened next? → Founder" : "O que historicamente aconteceu depois? → Founder") + '</a>'
      + '<div class="rp-ml" style="opacity:.55;margin-top:6px">' + (L ? "empirical distribution of past outcomes — never a forecast" : "distribuição empírica de desfechos passados — nunca previsão") + '</div>'
      + '</div>';
  }
  // a data traz a DISTRIBUIÇÃO (Founder)? — usado p/ decidir teaser × completo. Robusto ao spoof de localStorage: se a API gateou
  // (sem token de assinante), o base_rate vem como teaser (gated/sem mediana) e o cliente mostra o teaser mesmo com gpaid=true local.
  function analogHasDist(br) { return !!(br && br.h && !br.gated && ["3m", "6m", "12m"].some(function (k) { return br.h[k] && br.h[k].mediana != null; })); }
  // ★ 1E parte 2 — série de DIFERENÇAS (cruza zero: IPCA, curvas, term premium): o servidor manda
  //   base_rate.modo:"diff"/unidade:"pp" e o cone vem ADITIVO (lastV + quantil das diferenças). Aqui o sinal
  //   primário é a unidade do base_rate (sobrevive ao gate free); fallback = cone presente + hist com ≤0
  //   (espelho da regra temNeg do servidor: cone de razão NUNCA roda em série que cruza zero).
  function serieDiff(s) { if (!s) return false; var br = s.base_rate; if (br && (br.unidade === "pp" || br.modo === "diff")) return true; return !!(s.cone && s.hist && s.hist.some(function (v) { return v != null && v <= 0; })); }
  function brUnit(br) { return (br && (br.unidade === "pp" || br.modo === "diff")) ? "pp" : "%"; }
  // variação em pp computada do PRÓPRIO histórico (display, não método novo) — substitui os cards de retorno %
  // em série diff (stats.ret de razão vira lixo com base ~0: IPCA marcava "+644% em 6m").
  function ppDeltas(s) {
    if (!s || !s.hist || !s.datas || s.datas.length !== s.hist.length || s.hist.length < 2) return null;
    var n = s.hist.length, last = s.hist[n - 1], ld = new Date(String(s.datas[n - 1]).slice(0, 10) + "T00:00:00Z");
    if (last == null || !isFinite(last) || isNaN(+ld)) return null;
    var at = function (mo) { var t = new Date(+ld); t.setUTCMonth(t.getUTCMonth() - mo); var iso = t.toISOString().slice(0, 10);
      for (var i = n - 1; i >= 0; i--) { if (String(s.datas[i]).slice(0, 10) <= iso) { var v = s.hist[i]; return (v != null && isFinite(v)) ? Math.round((last - v) * 100) / 100 : null; } } return null; };
    return { m1: at(1), m3: at(3), m6: at(6), y1: at(12) };
  }
  // modal "ampliar": gráfico grande (futuro realçado) + complementares + correlações — 3ª camada de profundidade
  // ★ ESTÚDIO — cruzar até 3 séries (qualquer classe) rebaseadas a 100, alinhadas por grade MENSAL (lida com diário×mensal) + correlação
  var CMP_COLORS = ["var(--_accent)", "var(--_cool)", "var(--_warm)"];
  function compareChart(list, lang, opt) {
    opt = opt || {}; var big = !!opt.big, L = lang === "en";
    var valid = list.filter(function (x) { return x && x.hist && x.hist.length > 2 && x.datas && x.datas.length === x.hist.length; });
    if (valid.length < 2) return { err: "data" };  // #4: uma das séries não carregou / veio vazia ou sem datas
    var maps = valid.map(function (x) { var m = {}; for (var i = 0; i < x.hist.length; i++) { var d = (x.datas[i] || "").slice(0, 7); if (d && isFinite(x.hist[i])) m[d] = x.hist[i]; } return m; });
    var months = maps.map(function (m) { return Object.keys(m).sort(); });
    if (months.some(function (mm) { return !mm.length; })) return { err: "data" };
    var lo = months.map(function (mm) { return mm[0]; }).reduce(function (a, b) { return a > b ? a : b; });
    var hi = months.map(function (mm) { return mm[mm.length - 1]; }).reduce(function (a, b) { return a < b ? a : b; });
    if (lo >= hi) return { err: "overlap" };  // #4: as séries não têm NENHUM mês em comum (não se sobrepõem no tempo)
    var gset = {}; months.forEach(function (mm) { mm.forEach(function (mo) { if (mo >= lo && mo <= hi) gset[mo] = 1; }); });
    var grid = Object.keys(gset).sort();
    if (grid.length < 3) return { err: "short" };  // #4: sobrepõem, mas < 3 meses em comum — cruzamento sem confiança
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
    return { svg: o, leg: valid.map(function (x, i) { return { nome: x.nome, color: CMP_COLORS[i % 3], fim: reb[i].filter(function (v) { return v != null; }).slice(-1)[0] }; }), pairs: pairs, desde: grid[0], mn: mn, mx: mx, grid: grid, reb: reb };  // BUG B: grid (meses comuns) + reb (séries rebaseadas) p/ o mount interativo (upCompare); o SVG segue como fallback
  }
  // #4 — mensagem ESPECÍFICA de falha do Estúdio (em vez do genérico "sem sobreposição"): distingue dado ausente × sem sobreposição × janela curta.
  function cmpErrMsg(code, L) {
    if (code === "overlap") return L ? "these two series never coexisted in time — no overlapping period to cross. Pick a pair that lived at the same time (e.g. drop the one that starts later)." : "essas duas séries nunca coexistiram no tempo — não há período em comum para cruzar. Escolha um par que viveu ao mesmo tempo (ex.: tire a que começa depois).";
    if (code === "short") return L ? "they overlap for fewer than 3 months — too short to cross with confidence. Try a longer-lived pair." : "o período em comum tem menos de 3 meses — curto demais para cruzar com confiança. Tente um par com mais histórico.";
    return L ? "couldn’t load one of the series (empty or missing dates). Try another asset." : "não consegui carregar uma das séries (vazia ou sem datas). Tente outro ativo.";
  }
  // BUG B — comparativo INTERATIVO: monta o cruzamento rebaseado (compareChart) como uPlot (pan/zoom/crosshair nativos,
  //   igual ao gráfico principal) quando a engine está ligada; senão cai no SVG estático de sempre. redrawSelf = no toque de
  //   tema (claro/escuro) redesenha ESTE comparativo enquanto o modo estiver ativo (assume a entrada de re-tema do preço em
  //   _upMounted; o Estúdio restaura p/ drawUp ao voltar a 1 série). Devolve true se montou em uPlot.
  function rpMountCompareChart(cc, chartEl, yax, redrawSelf) {
    if (uplotOn() && cc.grid && cc.reb && cc.reb.length >= 2 && window.RPUplot.upCompare) {
      var datas = cc.grid.map(function (mo) { return mo + "-01"; });  // mês YYYY-MM → dia 1 (timestamp) p/ o eixo temporal
      var list = cc.reb.map(function (vals, i) { return { vals: vals, nome: (cc.leg[i] || {}).nome || "", color: (cc.leg[i] || {}).color }; });
      chartEl.innerHTML = "";  // limpa SVG/eixo anterior antes do mount (clear() do uPlot cuida da instância)
      var u = window.RPUplot.upCompare(chartEl, list, { datas: datas, preRebased: true, height: 200, nav: true, axisW: 52, hideX: false });
      if (u) {
        for (var i = _upMounted.length - 1; i >= 0; i--) if (_upMounted[i].el === chartEl) _upMounted.splice(i, 1);
        if (redrawSelf) _upMounted.push({ el: chartEl, draw: redrawSelf });  // re-tema redesenha o comparativo, não o preço
        return true;
      }
    }
    chartEl.innerHTML = cc.svg;
    yax.innerHTML = [[5, cc.mx], [50, (cc.mn + cc.mx) / 2], [95, cc.mn]].map(function (p) { return '<span class="rp-yl" style="top:' + p[0] + '%">' + esc(Math.round(p[1])) + '</span>'; }).join("");
    chartEl.appendChild(yax);
    return false;
  }

  // ── PAINEL DE TAXA-BASE (device estilo SentimenTrader): "em casos análogos, subiu em X% das vezes, mediana +Y% em 3/6/12m" ──
  // P7: distribuição empírica de casos passados, NUNCA previsão/sinal de trade. Degrada se s.base_rate ausente/incompleto.
  function baseRatePanel(br, L, pro) {
    if (!br) return "";  // aceita teaser ({n,classificacao}) OU forma completa (h[])
    if (!analogHasDist(br)) return analogFreeHTML(br, L);  // ★ P1 (rodada 50 personas): a API decide — free recebe h.3m COMPLETO (a jornada termina numa resposta real); spoof local não adiciona dado (6m/12m só vêm com token Founder)
    var HS = [["3m", "3m"], ["6m", "6m"], ["12m", "12m"]];
    var U = brUnit(br);  // 1E p2: série diff → pp
    var sgn = function (x) { return (x == null || !isFinite(x)) ? "—" : (x >= 0 ? "+" : "") + (U === "pp" ? Math.round(x * 100) / 100 : Math.round(x * 10) / 10) + U; };
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
      var nTxt = (d.n != null) ? ' · <span style="color:var(--_dim)">' + d.n + (L ? " analogous cases" : " casos análogos") + (d.n_efetivo != null ? (L ? " · effective n " : " · n efetivo ") + d.n_efetivo : "") + '</span>' : "";  // §7.1: janelas sobrepostas → n cru engana; n_efetivo é a amostra independente
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
    if (!pro) out += '<div class="rp-ml" style="margin-top:5px;opacity:.92">' + lockA(L, '<span style="color:var(--_accent)">🔒</span> ' + (L ? "6-month & 12-month horizons in Founder" : "prazos de 6 e 12 meses no Founder")) + '</div>';  // free = só 3m; demais prazos = investigação paga
    out += '<div class="rp-ml" style="opacity:.6;margin-top:6px">' + (L ? "empirical distribution of past analogous cases — not a forecast" : "distribuição de casos análogos passados — não é previsão") + '</div>';
    return out;
  }

  function openBig(s, title, meta, lang, fund, preCmp, _retry) {
    if (!s || !s.hist || s.hist.length < 2) return; var L = lang === "en";
    // ★ lazy-load: engine pedida mas ainda não carregou → "Carregando gráfico…" + ensureUplot, depois reabre rico
    //   (nunca cai em SVG por falta de engine). _retry evita laço se o asset falhar (aí segue p/ o fallback SVG).
    if (RP_ENGINE === "uplot" && !uplotOn() && !_retry) {
      var pend = rpLoadingModal(lang);
      ensureUplot(function () { pend.close(); if (!pend.cancelled) openBig(s, title, meta, lang, fund, preCmp, true); });
      return;
    }
    // O gráfico grande é a MAIOR isca → free SEMPRE abre (sem gate de abertura). O upsell vem das FEATURES gated
    // dentro: manipular (zoom/brush), comparar A×B (Estúdio), cone completo p10–p90, overlays além dos 2 do free.
    var gpaid = rpIsPro();  // leitor canônico do plano (single-source-of-truth)
    var imx = !!(preCmp && preCmp.length >= 2);  // ★ modo INTERMERCADO (lead-lag): big-chart = upDual (2 pontas + razão) em cima + Ânima/Risco Perene empilhados embaixo (estilo leadlagreport). s = numerador (traz risco/anima/datas globais alinhados).
    var imxData = null;  // { a, b, c, datas, labels } — as 2 pontas (rebaseadas) + a razão, alinhadas às datas do numerador; só fica pronto após buscar den+ratio.
    var cur = s.hist[s.hist.length - 1];
    var cone = (s.cone && s.cone.mid && s.cone.mid.length > 1) ? s.cone : null;
    // 1E p2: série diff (cruza zero) → cone é ADITIVO; o delta é (v − cur) em pp, nunca razão (dividir por ~0 explode)
    var isDiff = serieDiff(s);
    var dp = isDiff
      ? function (v) { return (v != null && cur != null) ? Math.round((v - cur) * 100) / 100 : null; }
      : function (v) { return (v != null && cur) ? Math.round(((v - cur) / Math.abs(cur)) * 1000) / 10 : null; };
    var sgn = function (x) { return (x >= 0 ? "+" : "") + x + (isDiff ? "pp" : "%"); };
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
    if (s.stats && isDiff) { var stD = s.stats, ppd = ppDeltas(s);
      // 1E p2 — stats de RAZÃO viram lixo em série que cruza zero (IPCA marcava "+644% em 6m", vol 651%):
      // variação honesta em pp computada do próprio histórico; vol/Sharpe/drawdown (domínio de razão) abstêm.
      if (ppd) { var cellsD = [["m1", "1m"], ["m3", "3m"], ["m6", "6m"], ["y1", "12m"]].map(function (p) { var val = ppd[p[0]]; if (val == null) return ""; return '<div class="rp-rcard"><b style="color:var(--_txt)">' + (val >= 0 ? "+" : "") + val + 'pp</b><span>' + esc(p[1]) + '</span></div>'; }).join("");
        if (cellsD) depth += '<div class="rp-ml" style="margin-top:9px"><b>' + (L ? "Change (pp)" : "Variação (pp)") + '</b></div><div class="rp-rc">' + cellsD + '</div>'; }
      if (stD.pos52 != null) depth += '<div class="rp-ml" style="margin-top:8px">' + (L ? "52-week range · " : "Faixa de 52 semanas · ") + (L ? "low " : "mín ") + esc(fmtNum(stD.lo52)) + ' ─ ' + (L ? "high " : "máx ") + esc(fmtNum(stD.hi52)) + '</div><div class="rp-52"><i style="left:' + stD.pos52 + '%"></i></div><div class="rp-ml" style="opacity:.6">' + (L ? "at " : "em ") + stD.pos52 + (L ? "% of range" : "% da faixa") + '</div>'; }
    else if (s.stats) { var st = s.stats;
      var labs = st.monthly ? [["m1", "1m"], ["m3", "3m"], ["m6", "6m"], ["y1", "12m"]] : [["d1", "1d"], ["w1", "1sem"], ["m1", "1m"], ["m3", "3m"], ["m6", "6m"], ["y1", "12m"]];
      var neutral = st.is_asset === false;  // P1: macro/fiscal — variação é fato, não bom/ruim; sem cor de valência
      var cells = labs.map(function (p) { var val = st.ret[p[0]]; if (val == null) return ""; var col = neutral ? "var(--_txt)" : (val >= 0 ? "var(--_warm)" : "var(--_cool)"); return '<div class="rp-rcard"><b style="color:' + col + '">' + (val >= 0 ? "+" : "") + val + '%</b><span>' + esc(L && p[1] === "1sem" ? "1w" : p[1]) + '</span></div>'; }).join("");
      if (cells) depth += '<div class="rp-ml" style="margin-top:9px"><b>' + (L ? "Returns" : "Retornos") + '</b></div><div class="rp-rc">' + cells + '</div>';  // ★ retornos como cards (briefing: cara de laboratório, não tira de texto)
      if (st.pos52 != null) depth += '<div class="rp-ml" style="margin-top:8px">' + (L ? "52-week range · " : "Faixa de 52 semanas · ") + (L ? "low " : "mín ") + esc(fmtNum(st.lo52)) + ' ─ ' + (L ? "high " : "máx ") + esc(fmtNum(st.hi52)) + '</div><div class="rp-52"><i style="left:' + st.pos52 + '%"></i></div><div class="rp-ml" style="opacity:.6">' + (L ? "at " : "em ") + st.pos52 + (L ? "% of range" : "% da faixa") + '</div>';
      depth += '<div class="rp-ml" style="margin-top:6px"><b>' + (L ? "Volatility " : "Volatilidade ") + st.vol + '%</b> ' + (L ? "(annualized)" : "(anualizada)") + (st.dd_top != null ? ' · ' + (L ? "drawdown from peak " : "queda do topo ") + '<b style="color:var(--_cool)">' + st.dd_top + '%</b>' : '') + '</div>';
      if (st.sharpe != null) depth += '<div class="rp-ml" style="opacity:.6"><b>Sharpe ' + st.sharpe + '</b> · ' + (L ? "risk-adjusted vs Selic " : "risco-ajustado vs Selic ") + st.rf + '% — ' + (st.sharpe >= 0.3 ? (L ? "beats the risk-free" : "supera a renda fixa") : st.sharpe <= -0.3 ? (L ? "below the risk-free" : "abaixo da renda fixa") : (L ? "statistically indistinguishable from the risk-free" : "estatisticamente indistinguível da renda fixa")) + '</div>'; }  // ★ Sharpe demovido (briefing: baixa prioridade, não compete com os precedentes)
    var wSerie = (isDiff || (s.stats && s.stats.is_asset === false)) ? (L ? "series" : "série") : (L ? "price" : "preço");  // 1E p2: subtítulo "preço" genérico era mentira p/ IPCA/curva
    h += '<div class="rp-ml">' + (imx ? (L ? "two ends + their ratio (the lead-lag signal) → today" : "as duas pontas + a razão (o sinal lead-lag) → hoje") : (cone ? wSerie + (L ? " · history → today → fan of outcomes from analogous cases (median case · range of the 50% and 80% of cases)" : " · histórico → hoje → leque de desfechos de casos análogos (caso mediano · faixa dos 50% e dos 80% dos casos)") : wSerie + (L ? " · history → today → projection (dashed)" : " · histórico → hoje → projeção (tracejada)"))) + '</div>';
    // default = 3M: períodos longos comprimem anos num modal estreito ("tudo espremido"); abrir curto deixa o cone/preço legíveis.
    // ★ P1 2026-06-10 (rodada 50 personas): TODOS os períodos do gráfico de PREÇO são free — histórico de preço é commodity ("travar é incoerente com o pitch de memória", ~20 personas); o moat real (cone/faixas/hit-rate) segue gateado no SERVIDOR. Fecha também o furo B3 (lock era só client-side).
    h += '<div class="rp-per">' + [["3", "3M"], ["6", "6M"], ["12", L ? "1Y" : "1A"], ["36", L ? "3Y" : "3A"], ["0", "MAX"]].map(function (p) {
      var m = parseFloat(p[0]); var locked = false; void m;  // períodos livres p/ todos (ver acima)
      var cls = (p[0] === "3" ? "on" : "") + (locked ? " lock" : "");
      return '<button data-m="' + p[0] + '"' + (locked ? ' data-max="1"' : '') + (cls.trim() ? ' class="' + cls.trim() + '"' : '') + '>' + esc(p[1]) + (locked ? " 🔒" : "") + '</button>';
    }).join("") + '</div>';
    var useUp = uplotOn() && RP_UP.price;  // herói em uPlot? (flag on + engine pronta + price migrado)
    var hasStack = useUp && !!((s.anima && s.anima.serie && s.anima.serie.length > 1) || (s.risco && s.risco.serie && s.risco.serie.length > 1));  // tem oscilador empilhado? (preço esconde o eixo-X, datas vão p/ o painel de baixo)
    var SYNC = "rpbig" + (++_syncSeq);  // grupo de sync (crosshair + janela-x) deste modal: preço ↔ Ânima ↔ risk
    h += '<div class="rp-chart">' + (useUp ? '' : bigChart(s, { big: true })) + '</div>';  // uPlot desenha no div vazio depois do innerHTML
    if (!gpaid) {  // FREE: 2 overlays (1 projeção = cone/mediana + 1 indicador) — "gostinho"; manipular/comparar/cone-completo ficam no Founder
      var freeIds = ["cone"]; if (s.ma200 && s.ma200.length) freeIds.push("ma200");  // valor-justo (linha) = Founder; free vê o prêmio/desconto em TEXTO (decisão do dono)
      var fLbl = { cone: (L ? "Projection (median)" : "Projeção (mediana)"), fair: "Valuation", ma200: "MM200" };
      h += '<div class="rp-tgf" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px">' + freeIds.map(function (id) { var don = ((RP_LAYERS.filter(function (l) { return l.id === id; })[0]) || {}).defaultOn; return '<button class="rp-tog" data-fk="' + id + '" data-lbl="' + esc(fLbl[id]) + '" style="font-size:10px;background:var(--_card2);border:1px solid var(--_line);color:var(--_dim);border-radius:6px;padding:3px 9px;cursor:pointer">' + (don ? "● " : "○ ") + esc(fLbl[id]) + '</button>'; }).join("") + '<span class="rp-ml" style="opacity:.5">' + (L ? "· compare A×B & manipulate in Founder" : "· comparar A×B & manipular no Founder") + '</span></div>';
    }
    var lead = "";  // ★ precedentes (cone + análogos) — sobem p/ logo abaixo do chart (briefing: subordinam só ao gráfico principal). Em modo imx (lead-lag) seguem suprimidos como antes.
    if (cone) { var dmid = dp(cone.mid[cone.mid.length - 1]);
      if (gpaid && cone.lo && cone.hi) { var dlo = dp(cone.lo[cone.lo.length - 1]), dhi = dp(cone.hi[cone.hi.length - 1]), dlo2 = (cone.lo2 ? dp(cone.lo2[cone.lo2.length - 1]) : null), dhi2 = (cone.hi2 ? dp(cone.hi2[cone.hi2.length - 1]) : null);  // bandas só se a data trouxe (token); gateado → cai p/ a mediana abaixo (sem quebrar)
        if (dmid != null) lead += '<div class="rp-ml"><b style="color:var(--_warm)">' + (L ? "Median case " : "Caso mediano ") + sgn(dmid) + '</b>' + (dlo != null && dhi != null ? ' · ' + (L ? "50% of cases " : "50% dos casos ") + sgn(dlo) + ' … ' + sgn(dhi) : '') + (dlo2 != null && dhi2 != null ? ' · ' + (L ? "80% of cases " : "80% dos casos ") + sgn(dlo2) + ' … ' + sgn(dhi2) : '') + ' · ' + (L ? "in similar situations in the past — not a forecast" : "em situações parecidas no passado — não é previsão") + '</div>'; }
      else if (dmid != null) lead += '<div class="rp-ml">' + (L ? "Analog projection available" : "Projeção de casos análogos disponível") + ' · <span style="opacity:.78">' + lockA(L, '<span style="color:var(--_accent)">🔒</span> ' + (L ? "median case & 50% / 80% ranges in Founder" : "caso mediano & faixas 50% / 80% no Founder")) + '</span></div>'; }  // ★ free NÃO vê o número (prognóstico = moat); a linha mediana no gráfico fica como gancho visual
    else { var dpct = dp((s.proj && s.proj.length > 1) ? s.proj[s.proj.length - 1] : null);
      if (dpct != null) lead += gpaid
        ? '<div class="rp-ml"><b style="color:var(--_warm)">' + (L ? "projection " : "projeção ") + sgn(dpct) + '</b> · ' + (L ? "linear, under current conditions — not a forecast" : "linear, sob condições atuais — não é previsão") + '</div>'
        : '<div class="rp-ml">' + (L ? "Projection under current conditions" : "Projeção sob condições atuais") + ' · <span style="opacity:.78">' + lockA(L, '<span style="color:var(--_accent)">🔒</span> ' + (L ? "value in Founder" : "valor no Founder")) + '</span></div>'; }
    if (s.base_rate) lead += baseRatePanel(s.base_rate, L, gpaid);  // casos análogos — free: teaser (existência+nº+leitura) / Founder: distribuição completa
    if (s.fair && s.fair.premio_pct != null) { var isFii = s.fair.tipo === "fii";
      depth += '<div class="rp-ml" style="margin-top:6px">' + (isFii ? (L ? "Net asset value (NAV) " : "Valor patrimonial (NAV) ") : "Valuation ") + '<b style="color:var(--_warm)">' + (s.fair.premio_pct >= 0 ? "+" : "") + esc(s.fair.premio_pct) + '%</b> ' + (isFii ? ((L ? "vs price · P/NAV " : "vs preço · P/VP ") + esc(s.fair.pvp) + ' · ' + (L ? "anchored on the fund’s book value, descriptive" : "ancorado no patrimônio do fundo, descritivo")) : ((L ? "vs price · earnings × normal P/E " : "vs preço · lucro × P/L normal ") + esc(s.fair.pe_normal) + ' (' + (L ? "now " : "hoje ") + esc(s.fair.pe_now) + ') · ' + (L ? "anchored on the company’s own earnings, descriptive" : "ancorado no próprio lucro da empresa, descritivo"))) + '</div>'; }
    if (s.dcf && s.dcf.iv != null) depth += '<div class="rp-ml" style="margin-top:4px">' + (L ? "DCF intrinsic " : "DCF intrínseco ") + '<b>R$ ' + esc(s.dcf.iv) + '</b> · ' + (L ? "price " : "preço ") + '<b style="color:var(--_' + (s.dcf.premio_pct >= 0 ? "warm" : "cool") + ')">' + (s.dcf.premio_pct >= 0 ? "+" : "") + esc(s.dcf.premio_pct) + '%</b> · ' + (L ? "model from cash flow (growth " : "modelo do fluxo de caixa (cresc. ") + esc(s.dcf.g) + '% · ' + (L ? "discount " : "desconto ") + esc(s.dcf.r) + '%) — ' + (L ? "assumptions shown, not a forecast" : "premissas à mostra, não previsão") + '</div>';
    if (!imx) h += lead;  // ★ precedentes (cone + análogos) logo abaixo do chart, ACIMA dos índices — subordinam só ao gráfico principal (briefing). imx (lead-lag) segue sem precedentes.
    // ★ painéis empilhados (SentimenTrader): Ânima (humor) + Risk-on/off (regime), alinhados ao preço pela data — crosshair único atravessa os 3
    var aSel = animaActive(s, "estr", gpaid), aObj = aSel.obj;  // ★ Ânima: free=estrutural (252d), curto (63d)=Founder — seletor de horizonte
    var animaOk = !!aObj, riscoOk = s.risco && s.risco.serie && s.risco.serie.length > 1;
    if (useUp) {  // uPlot: placeholders vazios; os osciladores sincronizados montam após o innerHTML (mountStackOsc + wireAnima)
      if (animaOk) h += animaSelHTML(aSel, lang) + '<div class="rp-ml rp-anima-cap" style="margin-top:9px">' + esc(animaCap(aObj, lang, aSel.mode)) + '</div><div class="rp-osc rp-anima"></div>';
      if (riscoOk) h += '<div class="rp-ml" style="margin-top:7px">' + esc(oscCaption(s.risco, lang, "risk", s.mercado_br)) + '</div><div class="rp-osc rp-risk"></div>';
    } else {  // SVG (embed/fallback): osciladores estáticos
      if (animaOk) h += '<div class="rp-ml" style="margin-top:9px">' + esc(animaCap(aObj, lang, aSel.mode)) + '</div>' + riskPane(aObj, { big: true });
      if (riscoOk) h += '<div class="rp-ml" style="margin-top:7px">' + esc(oscCaption(s.risco, lang, "risk", s.mercado_br)) + '</div>' + riskPane(s.risco, { big: true });
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
    if (!imx) h += depth;  // ★ estatísticas detalhadas (retornos/52s/vol/Sharpe/taxa-base/valuation) — abaixo da Leitura rápida e da pilha de gráficos. No intermercado descrevem só o numerador (cesta sintética) → confundem; o dual+pilha+lead-lag já contam a história.
    if (meta && !(preCmp && preCmp.length >= 2)) h += '<div class="rp-ml" style="margin-top:9px">' + (L ? "relation — " : "relação — ") + esc(meta) + '</div>';  // no comparativo lead-lag a interpretação vira legenda do gráfico (não duplica aqui)
    h += '<div class="rp-ml" style="margin-top:9px">' + (L ? "descriptive, never a recommendation · full depth (custom ranges, correlations, scenarios) in the app →" : "descritivo, nunca recomendação · profundidade completa (períodos, correlações, cenários) no app →") + '</div></div>';
    var mw = document.createElement("div"); mw.className = "rp-mw"; mw.innerHTML = h;
    function close() { if (!mw.parentNode) return; rpTeardownCharts(mw); mw.parentNode.removeChild(mw); document.removeEventListener("keydown", onkey); unlockScroll(); }  // teardown uPlot+RO (sem vazar) · guard = idempotente
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
      if (wf && s.cone && s.cone.mid && s.cone.mid.length > 1) { if (gpaid && (s.cone.lo2 || s.cone.lo)) all = all.concat((s.cone.lo2 || s.cone.lo).slice(1), (s.cone.hi2 || s.cone.hi).slice(1)); else all = all.concat(s.cone.mid.slice(1)); }  // casa com o range do bigChart (free/gateado=só mediana; pro c/ bandas=p10–p90)
      else if (wf && s.proj && s.proj.length > 1) all = all.concat(s.proj.slice(1));
      var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), rg = (mx - mn) || 1;
      return [[5, mx], [27.5, mn + 0.75 * rg], [50, mn + 0.5 * rg], [72.5, mn + 0.25 * rg], [95, mn]].map(function (p) {  // 5 níveis alinhados às gridlines (eixo mais legível p/ análise precisa)
        return '<span class="rp-yl" style="top:' + p[0] + '%">' + esc(fmtNum(p[1])) + '</span>'; }).join("");
    }
    // ── uPlot (Sprint 1, herói): clona s refletindo os toggles free e (re)instancia upPrice no chartEl. ──
    //    Mantido num builder p/ o re-tema (MutationObserver) re-desenhar com a paleta nova.
    var _upInst = null;  // instância uPlot viva (ou null em modo SVG)
    var _navClamp = null;  // janela navegável permitida {min,max} = período selecionado (vale p/ FREE e Founder; BUG C). setado em setChart.
    // ── INTERMERCADO: painel de cima = upDual (2 pontas + razão), datado e sincronizado com os osciladores Ânima/risk embaixo. ──
    function drawDual(el) {
      if (!imxData) return null;  // ainda buscando den/ratio — mountIntermarket redesenha quando chegar
      if (_upInst && _upInst.destroy) { try { _upInst.destroy(); } catch (e) {} }
      _upInst = window.RPUplot.upDual(el, imxData.a, imxData.b, imxData.c, {
        datas: imxData.datas, sync: SYNC, big: true, height: 200, hideX: hasStack, axisW: 52, nav: true, lang: lang,
        clamp: function () { return _navClamp; },
        onReset: function () { var on = mw.querySelector(".rp-per button.on"); var fr = (on && on.getAttribute("data-m") != null) ? parseFloat(on.getAttribute("data-m")) : 3; setChart(isFinite(fr) ? fr : 3); }
      });  // nav clampada (free = zoom DENTRO do 3M sem escapar; Founder = livre, _navClamp null) — paridade c/ o gráfico do ticket; sync propaga a janela aos osciladores
      return _upInst;
    }
    // busca as 2 pontas (denominador) + a razão e alinha às datas do numerador (s) → as 3 séries dividem a MESMA grade (vêm das mesmas linhas de components), então o "alinhamento delicado" some.
    function mountIntermarket() {
      var tgf = mw.querySelector(".rp-tgf"); if (tgf) tgf.style.display = "none";  // toggles de overlay do ativo único não valem no dual
      chartEl.innerHTML = '<div class="rp-ml" style="opacity:.6;padding:22px 0;text-align:center">' + (L ? "loading lead-lag…" : "carregando lead-lag…") + '</div>';
      var cod = preCmp[0].cod;
      var aLbl = preCmp[0].nome || (L ? "Numerator" : "Numerador");
      var denLbl = (preCmp[1] && preCmp[1].cls === "intermercado_den") ? (preCmp[1].nome || "IBOV") : "IBOV";  // pré-carga = [num, den OU razão÷IBOV, IBOV]: quando [1] é a razão, a 2ª ponta é o IBOV
      var ratLbl = aLbl + "÷" + denLbl;
      var serieURL = API.replace("/v1/digest", "/v1/serie");
      var fOne = function (cls) { return fetch(serieURL + "?codigo=" + encodeURIComponent(cod) + "&classe=" + cls, fopt()).then(function (r) { return r.json(); }).catch(function () { return null; }); };
      Promise.all([fOne("intermercado_den"), fOne("intermercado_ratio")]).then(function (res) {
        var den = res[0], rat = res[1];
        var mapOf = function (d) { var m = {}; if (d && d.hist && d.datas && d.hist.length === d.datas.length) { for (var i = 0; i < d.datas.length; i++) m[d.datas[i]] = d.hist[i]; } return m; };
        var dm = mapOf(den), rm = mapOf(rat);
        var A = [], B = [], C = [], hasB = false, hasC = false;
        for (var i = 0; i < s.datas.length; i++) { var dt = s.datas[i];
          A.push(s.hist[i]);
          var bv = dm[dt]; B.push(bv != null ? bv : null); if (bv != null) hasB = true;
          var cv = rm[dt]; C.push(cv != null ? cv : null); if (cv != null) hasC = true;
        }
        if (!hasB) { chartEl.innerHTML = '<div class="rp-ml" style="opacity:.7;padding:18px 0;text-align:center">' + (L ? "intermarket series unavailable" : "série do intermercado indisponível") + '</div>'; return; }
        imxData = { a: A, b: B, c: hasC ? C : null, datas: s.datas, labels: [aLbl, denLbl, ratLbl] };
        setChart(3);  // 3M default (free clampado) → drawUp→drawDual desenha o dual + propaga a janela aos osciladores Ânima/risk via SYNC
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(function () { setChart(3); });
        renderImxLegend(aLbl, denLbl, ratLbl);
      });
    }
    function renderImxLegend(a, b, c) {
      var lg = mw.querySelector(".rp-imx-leg");
      if (!lg) { lg = document.createElement("div"); lg.className = "rp-imx-leg"; lg.style.marginTop = "5px"; chartEl.parentNode.insertBefore(lg, chartEl.nextSibling); }
      lg.innerHTML = '<div class="rp-ml">'
        + '<span style="white-space:nowrap;margin-right:11px"><b style="color:var(--_accent)">▬</b> ' + esc(a) + '</span>'
        + '<span style="white-space:nowrap;margin-right:11px"><b style="color:var(--_cool)">▬</b> ' + esc(b) + '</span>'
        + '<span style="white-space:nowrap"><b style="color:var(--_warm)">▦</b> ' + esc(c) + ' <span style="opacity:.6">(' + (L ? "ratio = who leads" : "razão = quem lidera") + ')</span></span>'
        + '</div>'
        + (meta ? '<div class="rp-ml" style="margin-top:3px"><b style="color:var(--_accent)">Lead-lag</b> — ' + esc(meta) + '</div>' : '')
        + '<div class="rp-ml" style="opacity:.7;margin-top:2px">' + (L ? "rebased to 100 · the two ends + their ratio · below: BR market Mood & Perene Risk, date-aligned" : "rebaseado a 100 · as duas pontas + a razão · abaixo: Humor BR & Risco Perene, alinhados pela data") + '</div>';
    }
    function drawUp(el) {  // el = chartEl; lê o estado de overlays `ov` (free liga/desliga cone/fair/ma200)
      if (imx) return drawDual(el);  // intermercado: dual no lugar do preço único
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
          var futSpan = (maxFull != null && endTs != null) ? (maxFull - endTs) : 0;  // largura TOTAL do cone/futuro (fixo ~6M)
          // ★ futuro PROPORCIONAL à janela visível: senão nas janelas CURTAS (3M) o cone de 6M ocupava ~60% da largura,
          //   espremia o preço e deixava os osciladores com espaço morto. Mostra ~30% de futuro (≈42% do passado), capado
          //   no fim do cone; janelas longas (3A/MAX) mostram o cone INTEIRO. O dado do cone segue completo — Founder navega até o fim.
          var pastSpan = (endTs != null && mn != null) ? (endTs - mn) : futSpan;
          var futShown = futSpan > 0 ? Math.min(futSpan, Math.max(pastSpan * 0.42, futSpan * 0.2)) : 0;
          var mx = (endTs != null) ? (endTs + futShown + futShown * 0.06) : (maxFull != null ? maxFull : null);
          if (mn != null && mx != null && mx > mn) { _upInst.setScale("x", { min: mn, max: mx }); _navClamp = { min: mn, max: mx };  // BUG C: o PERÍODO é o controle de largura p/ TODOS (Founder incluso) — pan/zoom preso à janela; ver mais = trocar período (6M/1A/3A/MAX). Antes gpaid?null deixava o Founder navegar o histórico inteiro dentro do 3M.
            // P0#2: garante explicitamente a janela nos osciladores empilhados (Ânima/risk). O linkScaleHook já propaga via grupo
            //   de sync, mas reaplicar direto pelo _rpU (instância viva, setada no keep()) blinda contra qualquer corrida de
            //   timing — se já estão na janela, é no-op (setScale a valores iguais); o guard do hook evita laço de volta ao preço.
            [".rp-anima", ".rp-risk"].forEach(function (sel) { var oe = mw.querySelector(sel), ou = oe && oe._rpU; if (ou && ou.setScale && ou.scales && ou.scales.x && (ou.scales.x.min !== mn || ou.scales.x.max !== mx)) { try { ou.setScale("x", { min: mn, max: mx }); } catch (e) {} } });
          }  // FREE: trava a navegação nesta janela (zoom/pan dentro, sem escapar pro passado)
        }
        return;
      }
      paint(curHist, true);
    }
    // ── FASE A (síncrona, NO CLIQUE): pinta o chrome do modal (título · períodos · .rp-chart) e devolve o clique RÁPIDO → INP curto. O mount caro de canvas sai p/ a Fase B (próximo frame). ──
    lockScroll();  // congela a página atrás (sem 2ª rolagem) + compensa a barra (sem pulo) ANTES de montar
    document.body.appendChild(mw);  // ★ modal no DOM ANTES do mount — uPlot monta em elemento vivo/dimensionado (senão erra e o modal nem abre)
    document.addEventListener("keydown", onkey);  // Esc fecha já na Fase A (antes do mount caro)
    if (useUp) chartEl.innerHTML = '<div class="rp-ml" style="opacity:.5;display:flex;align-items:center;justify-content:center;height:200px">' + (L ? "Loading chart…" : "Carregando gráfico…") + '</div>';  // placeholder até a Fase B (.rp-chart já reserva 200px → sem CLS; upPrice→clear() o remove ao montar)
    // ── FASE B (PRÓXIMO FRAME, task separada): o mount CARO — mountStackOsc (osciladores) + setChart (instanciar os uPlots/canvas) — sai do caminho do clique. Medido: ~65ms @4×CPU saem do INP da interação. ──
    function rpMountBig() {
      if (!mw.parentNode) return;  // abriu e fechou no mesmo frame → aborta o mount (sem draw-after-close)
      if (useUp) { _upMounted.push({ el: chartEl, draw: drawUp }); }  // registra p/ re-tema (re-desenha no toggle claro/escuro)
      // osciladores PRIMEIRO, preço POR ÚLTIMO: o link-group propaga a janela do último a setá-la → o preço (setChart) impõe
      // a janela a Ânima/risk (senão o autoscale dos osciladores na montagem sobrescreveria o período do preço).
      if (useUp) { mountStackOsc(mw.querySelector(".rp-anima"), mw.querySelector(".rp-risk"), s, SYNC, lang, true, aObj, gpaid); wireAnima(mw, s, lang, gpaid, SYNC, true); }  // osciladores empilhados (Ânima/risk) no MESMO grupo de sync/janela do preço + seletor de horizonte
      setChart(3);  // abre em 3M (default legível); MAX/longos via botões (gated p/ free)
      if (useUp && typeof requestAnimationFrame === "function") requestAnimationFrame(function () { setChart(3); });  // reaplica a janela após o layout/ResizeObserver dos osciladores assentar no mount (senão o auto-range deles re-propaga "tudo" e o 3M inicial era ignorado)
    if (!gpaid && !(imx && useUp)) {  // free: liga/desliga os 2 overlays + repinta (sem estúdio/manipulação) — não vale no intermercado (dual não tem cone/MM)
      mw.querySelectorAll(".rp-tog[data-fk]").forEach(function (el) {
        el.addEventListener("click", function () { var k = el.getAttribute("data-fk"); ov[k] = !ov[k]; el.textContent = (ov[k] ? "● " : "○ ") + el.getAttribute("data-lbl"); paint(curHist, true); });
      });
    }
    // ── INTERMERCADO (uPlot): busca as 2 pontas (den) + a razão, alinha às datas do numerador e monta o dual empilhado. Substitui o SVG cru. ──
    if (imx && useUp) { mountIntermarket(); }
    // ★ ESTÚDIO (TradingView): cruzar até 3 séries (qualquer classe) + escolher camadas — só assinante
    else if (gpaid) {
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
        fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(cod) + "&classe=" + encodeURIComponent(cls), fopt())
          .then(function (r) { return r.json(); }).then(function (d) { cmpCache[key] = d; cb(d); }).catch(function () { cb(null); });
      };
      var drawCompare = function (got) {
        var cc = compareChart(got.filter(Boolean), lang, { big: true });
        if (!cc || cc.err) { chartEl.innerHTML = '<div class="rp-ml" style="opacity:.78;padding:18px 12px;text-align:center;line-height:1.45">' + esc(cmpErrMsg(cc && cc.err, L)) + '</div>'; legEl.innerHTML = ""; return; }
        rpMountCompareChart(cc, chartEl, yax, function () { drawCompare(got); });  // BUG B: uPlot interativo (pan/zoom) com fallback SVG; eixo-Y base-100 nativo do upCompare
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
          for (var ui = _upMounted.length - 1; ui >= 0; ui--) if (_upMounted[ui].el === chartEl) _upMounted.splice(ui, 1);  // BUG B: devolve o re-tema do chartEl ao preço (drawUp) — o compare havia assumido a entrada
          if (useUp) _upMounted.push({ el: chartEl, draw: drawUp });
          var on = mw.querySelector(".rp-per button.on"); var fr = (on && on.getAttribute("data-m") != null) ? parseFloat(on.getAttribute("data-m")) : 0; setChart(isFinite(fr) ? fr : 0);
        }
      };
      var fillPicker = function (pk) {  // preenche o picker da fonte ATUAL (universo completo se já carregou; senão o seed do digest)
        var src = (RP_CAT_FULL && RP_CAT_FULL.length) ? RP_CAT_FULL : RP_CAT;
        var chosen = {}; cmp.forEach(function (c) { chosen[c.cls + ":" + c.cod] = 1; });
        var html = "";
        src.forEach(function (g) {
          var items = g.items.filter(function (it) { return !chosen[it.cls + ":" + it.cod]; });
          if (!items.length) return;
          html += '<div class="rp-ml" style="opacity:.6;margin-top:3px">' + esc(g.cat) + '</div><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">' + items.map(function (it) { return '<button class="rp-pk" data-cod="' + esc(it.cod) + '" data-cls="' + esc(it.cls) + '" data-nome="' + esc(it.nome) + '" style="font-family:var(--_mono);font-size:10px;background:transparent;border:1px solid var(--_line);color:var(--_dim);border-radius:4px;padding:2px 7px;cursor:pointer">' + esc(it.nome) + '</button>'; }).join("") + '</div>';
        });
        pk.innerHTML = html || '<div class="rp-ml" style="opacity:.6">' + (L ? "nothing else to add" : "nada mais a adicionar") + '</div>';
        pk.querySelectorAll(".rp-pk").forEach(function (el) { el.addEventListener("click", function (e) { e.stopPropagation(); if (cmp.length >= 3) return; cmp.push({ cod: el.getAttribute("data-cod"), cls: el.getAttribute("data-cls"), nome: el.getAttribute("data-nome") }); applyMode(); }); });
      };
      var openPicker = function () {
        if (studio.querySelector(".rp-pkbox")) { studio.querySelector(".rp-pkbox").remove(); return; }
        var pk = document.createElement("div"); pk.className = "rp-pkbox"; pk.style.cssText = "margin-top:5px;max-height:170px;overflow:auto;border:1px solid var(--_line);border-radius:7px;padding:6px;background:var(--_card2)";
        fillPicker(pk); studio.appendChild(pk);  // mostra JÁ (seed); upgrade p/ o universo completo quando o /v1/catalog chega
        rpEnsureCatalog(lang, function () { if (pk.parentNode) fillPicker(pk); });
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
        studio.querySelectorAll(".rp-gtog").forEach(function (el) { el.addEventListener("click", function () { var gg = el.getAttribute("data-g"); if (gg === (s.g === "m" ? "m" : "d")) return; close(); fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(s.codigo) + "&classe=" + encodeURIComponent(s.classe) + "&g=" + gg, fopt()).then(function (r) { return r.json(); }).then(function (ns) { if (ns && ns.hist && ns.hist.length) openBig(ns, title, meta, lang, fund); }); }); });  // troca diário↔mensal → re-busca + reabre (recomputa a projeção)
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
        fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(c.cod) + "&classe=" + encodeURIComponent(c.cls), fopt())
          .then(function (r) { return r.json(); }).then(function (d) {
            gotF[i] = (d && d.hist) ? { nome: c.nome, hist: d.hist, datas: d.datas } : null;
            if (--pendF === 0) {
              var cc = compareChart(gotF.filter(Boolean), lang, { big: true });
              if (!cc || cc.err) { chartEl.innerHTML = '<div class="rp-ml" style="opacity:.78;padding:18px 12px;text-align:center;line-height:1.45">' + esc(cmpErrMsg(cc && cc.err, L)) + '</div>'; return; }
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
    }
    // DOUBLE-rAF (não 1): o 1º frame PINTA o shell+"Carregando" (handler ~11ms = INP curto), o mount caro vai p/ o 2º frame.
    //   Com 1 rAF só, o mount roda DENTRO do render do frame do clique (antes do 1º paint) → a long task ainda conta no INP. Medido @4×CPU: 1-rAF canvas já no frame 1 · 2-rAF placeholder no frame 1, canvas no frame 2.
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(function () { requestAnimationFrame(rpMountBig); }); else rpMountBig();
  }

  // ════ P3.1/P3.2 — COMPARAÇÃO lado a lado (laboratório) ════════════════════════════════════════════
  //   Dois ativos, cada um com SEU gráfico+cone, cards de retorno e precedentes (taxa-base) — reusa as
  //   funções PURAS bigChart/baseRatePanel. P3.2 = veredito comparativo (mediana/hit/dispersão/Sharpe/vol,
  //   vencedor destacado). Gating idêntico ao modal: free vê cone-mediana + precedentes-teaser; a
  //   distribuição (mediana/hit/dispersão) é Founder. Sem manipulação (snapshot read-only).
  function _cmpFetch(cod, cls) { return fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(cod) + "&classe=" + encodeURIComponent(cls), fopt()).then(function (r) { return r.json(); }).catch(function () { return null; }); }
  function _cmpRetCards(s, L) {
    if (serieDiff(s)) { var ppd = ppDeltas(s);  // 1E p2: série diff → variação em pp (stats.ret de razão engana)
      if (!ppd) return "";
      var cellsD = [["m3", "3m"], ["m6", "6m"], ["y1", "12m"]].map(function (p) { var v = ppd[p[0]]; if (v == null) return ""; return '<div class="rp-rcard"><b style="color:var(--_txt)">' + (v >= 0 ? "+" : "") + v + 'pp</b><span>' + esc(p[1]) + '</span></div>'; }).join("");
      return cellsD ? '<div class="rp-ml" style="margin-top:8px"><b>' + (L ? "Change (pp)" : "Variação (pp)") + '</b></div><div class="rp-rc">' + cellsD + '</div>' : "";
    }
    if (!s.stats || !s.stats.ret) return "";
    var st = s.stats, neutral = st.is_asset === false;
    var cells = [["m3", "3m"], ["m6", "6m"], ["y1", "12m"]].map(function (p) { var v = st.ret[p[0]]; if (v == null) return ""; var col = neutral ? "var(--_txt)" : (v >= 0 ? "var(--_warm)" : "var(--_cool)"); return '<div class="rp-rcard"><b style="color:' + col + '">' + (v >= 0 ? "+" : "") + v + '%</b><span>' + esc(p[1]) + '</span></div>'; }).join("");
    return cells ? '<div class="rp-ml" style="margin-top:8px"><b>' + (L ? "Returns" : "Retornos") + '</b></div><div class="rp-rc">' + cells + '</div>' : "";
  }
  function _cmpConeLine(s, L, gpaid) {
    var cur = s.hist[s.hist.length - 1], cone = (s.cone && s.cone.mid && s.cone.mid.length > 1) ? s.cone : null; if (!cone || cur == null) return "";
    var isDiff = serieDiff(s);  // 1E p2: cone aditivo → delta em pp
    var dp = isDiff ? function (v) { return v != null ? Math.round((v - cur) * 100) / 100 : null; } : function (v) { return (v != null && cur) ? Math.round(((v - cur) / Math.abs(cur)) * 1000) / 10 : null; }, sgn = function (x) { return (x >= 0 ? "+" : "") + x + (isDiff ? "pp" : "%"); };
    var dmid = dp(cone.mid[cone.mid.length - 1]);
    if (gpaid && cone.lo && cone.hi) { var dlo = dp(cone.lo[cone.lo.length - 1]), dhi = dp(cone.hi[cone.hi.length - 1]), dlo2 = cone.lo2 ? dp(cone.lo2[cone.lo2.length - 1]) : null, dhi2 = cone.hi2 ? dp(cone.hi2[cone.hi2.length - 1]) : null;
      return '<div class="rp-ml" style="margin-top:6px"><b style="color:var(--_warm)">' + (L ? "Median " : "Mediana ") + sgn(dmid) + '</b>' + (dlo != null ? ' · 50% ' + sgn(dlo) + '…' + sgn(dhi) : '') + (dlo2 != null ? ' · 80% ' + sgn(dlo2) + '…' + sgn(dhi2) : '') + '</div>'; }
    return dmid != null ? '<div class="rp-ml" style="margin-top:6px;opacity:.8"><span style="color:var(--_accent)">🔒</span> ' + (L ? "median & ranges in Founder" : "mediana & faixas no Founder") + '</div>' : "";
  }
  function _cmpCol(s, x, L, gpaid) {
    if (!s || !s.hist || s.hist.length < 2) return '<div class="rp-cmpcol"><div class="rp-mt2">' + esc(x.nome) + '</div><div class="rp-ml" style="opacity:.7;padding:22px 0;text-align:center">' + (L ? "series unavailable" : "série indisponível") + '</div></div>';
    return '<div class="rp-cmpcol"><div class="rp-mt2">' + esc(x.nome) + ' <span style="opacity:.55;font-weight:400">' + esc(fmtNum(s.hist[s.hist.length - 1])) + '</span></div><div class="rp-cmpchart">' + bigChart(s, { big: true, pro: gpaid }) + '</div>' + _cmpConeLine(s, L, gpaid) + _cmpRetCards(s, L) + (s.base_rate ? baseRatePanel(s.base_rate, L, gpaid) : '') + '</div>';
  }
  function _cmpVerdict(sA, sB, xA, xB, L, gpaid) {
    var rows = [], h6 = function (s, k) { var br = s && s.base_rate; return (br && br.h && br.h["6m"]) ? br.h["6m"][k] : null; };
    var num = function (v) { return (v != null && isFinite(v)) ? v : null; };
    function row(label, va, vb, fmt, higherWins, fmtB) {
      if (va == null && vb == null) return;
      var win = (higherWins != null && va != null && vb != null && va !== vb) ? (higherWins ? (va > vb ? 'a' : 'b') : (va < vb ? 'a' : 'b')) : '';  // higherWins null = sem vencedor (unidades diferentes não competem)
      rows.push('<tr><td>' + esc(label) + '</td><td' + (win === 'a' ? ' class="win"' : '') + '>' + (va != null ? fmt(va) : '—') + '</td><td' + (win === 'b' ? ' class="win"' : '') + '>' + (vb != null ? (fmtB || fmt)(vb) : '—') + '</td></tr>');
    }
    // 1E p2: unidade POR LADO (série diff = pp, preço = %); lados com unidades distintas não disputam o "win"
    var uA = brUnit(sA && sA.base_rate), uB = brUnit(sB && sB.base_rate), mixed = uA !== uB;
    var pfU = function (u) { return function (v) { return (v >= 0 ? "+" : "") + v + u; }; };
    var pp = function (v) { return v + "pp"; };
    var nA = sA && sA.base_rate ? (sA.base_rate.n != null ? sA.base_rate.n : h6(sA, "n")) : null, nB = sB && sB.base_rate ? (sB.base_rate.n != null ? sB.base_rate.n : h6(sB, "n")) : null;
    row(L ? "Episodes (n)" : "Episódios (n)", num(nA), num(nB), function (v) { return "" + v; }, true);
    var distA = sA && sA.base_rate && sA.base_rate.h && !sA.base_rate.gated, distB = sB && sB.base_rate && sB.base_rate.h && !sB.base_rate.gated;
    if (distA || distB) {
      row(L ? "Median 6m" : "Mediana 6m", num(h6(sA, "mediana")), num(h6(sB, "mediana")), pfU(uA), mixed ? null : true, pfU(uB));
      row(L ? "Hit rate 6m" : "Taxa de alta 6m", num(h6(sA, "hit")), num(h6(sB, "hit")), function (v) { return v + "%"; }, true);
      var disp = function (s) { var p7 = h6(s, "p75"), p2 = h6(s, "p25"); return (p7 != null && p2 != null) ? Math.round((p7 - p2) * 10) / 10 : null; };
      row(L ? "Dispersion 6m (p25–p75)" : "Dispersão 6m (p25–p75)", num(disp(sA)), num(disp(sB)), pp, mixed ? null : true);
    } else { rows.push('<tr><td>' + (L ? "Median · hit · dispersion 6m" : "Mediana · alta · dispersão 6m") + '</td><td colspan="2" style="text-align:center;opacity:.65"><span style="color:var(--_accent)">🔒</span> Founder</td></tr>'); }
    // vol/Sharpe são domínio de RAZÃO → lado diff abstém (IPCA marcava vol 651%)
    row(L ? "Volatility" : "Volatilidade", num(!serieDiff(sA) && sA && sA.stats && sA.stats.vol), num(!serieDiff(sB) && sB && sB.stats && sB.stats.vol), function (v) { return v + "%"; }, false);
    row("Sharpe", num(!serieDiff(sA) && sA && sA.stats && sA.stats.sharpe), num(!serieDiff(sB) && sB && sB.stats && sB.stats.sharpe), function (v) { return "" + v; }, true);
    if (rows.length < 2) return "";
    return '<div class="rp-tier2" style="margin-top:20px">' + (L ? "Precedents · head to head" : "Precedentes · comparativo") + '</div>' +
      '<table class="rp-cmptbl"><thead><tr><th></th><th>' + esc(xA.nome) + '</th><th>' + esc(xB.nome) + '</th></tr></thead><tbody>' + rows.join("") + '</tbody></table>' +
      '<div class="rp-ml" style="margin-top:6px;opacity:.6">' + (L ? "highlighted = the asset that led on each metric · descriptive, never a recommendation" : "destacado = o ativo que liderou em cada métrica · descritivo, nunca recomendação") + '</div>';
  }
  function compareTwo(a, b, lang) {
    var L = lang === "en", gpaid = rpIsPro();
    injectStyle();
    var head = '<button class="rp-x" aria-label="' + (L ? "close" : "fechar") + '">×</button><div class="rp-mt">' + (L ? "Compare" : "Comparar") + ' — ' + esc(a.nome) + ' × ' + esc(b.nome) + '</div>';
    var mw = document.createElement("div"); mw.className = "rp-mw";
    mw.innerHTML = '<div class="rp rp-mc rp-cmp2" role="dialog" aria-modal="true">' + head + '<div class="rp-ml" style="opacity:.7;padding:14px 0">' + (L ? "loading…" : "carregando…") + '</div></div>';
    function close() { if (!mw.parentNode) return; rpTeardownCharts(mw); mw.parentNode.removeChild(mw); document.removeEventListener("keydown", onkey); unlockScroll(); }  // teardown uPlot+RO (sem vazar) · guard = idempotente
    function onkey(e) { if (e.key === "Escape") close(); }
    mw.addEventListener("click", function (e) { var t = e.target; if (t === mw || (t.getAttribute && t.className === "rp-x")) close(); });
    document.addEventListener("keydown", onkey);
    lockScroll();
    document.body.appendChild(mw);
    Promise.all([_cmpFetch(a.cod, a.cls), _cmpFetch(b.cod, b.cls)]).then(function (res) {
      var box = mw.querySelector(".rp-cmp2"); if (!box) return;
      box.innerHTML = head + '<div class="rp-ml" style="margin-bottom:11px">' + (L ? "side by side · price, analog-case cone, returns and precedents — descriptive, never a recommendation" : "lado a lado · preço, cone de casos análogos, retornos e precedentes — descritivo, nunca recomendação") + '</div>' +
        '<div class="rp-cmpgrid">' + _cmpCol(res[0], a, L, gpaid) + _cmpCol(res[1], b, L, gpaid) + '</div>' + _cmpVerdict(res[0], res[1], a, b, L, gpaid);
    }).catch(function () { var el = mw.querySelector(".rp-cmp2 .rp-ml"); if (el) el.textContent = (L ? "comparison unavailable" : "comparação indisponível"); });
  }

  // ════ P3.3 — BIBLIOTECA DE ESTUDOS (laboratório): "o que aconteceu depois quando <condição>?" ════
  //   Modal de UM estudo (objeto editorial): definição · distribuição 3/6/12m (mediana·%alta·faixa50·faixa80)
  //   vs taxa-base do IBOV · interpretação P7 · comparações. Dados da Edge Function própria /functions/v1/estudos.
  function openEstudo(chave, nome, lang) {
    var L = lang === "en"; injectStyle();
    var head = '<button class="rp-x" aria-label="' + (L ? "close" : "fechar") + '">×</button><div class="rp-mt">📚 ' + esc(nome || chave) + '</div>';
    var mw = document.createElement("div"); mw.className = "rp-mw";
    mw.innerHTML = '<div class="rp rp-mc rp-est" role="dialog" aria-modal="true">' + head + '<div class="rp-ml" style="opacity:.7;padding:14px 0">' + (L ? "loading…" : "carregando…") + '</div></div>';
    function close() { if (!mw.parentNode) return; rpTeardownCharts(mw); mw.parentNode.removeChild(mw); document.removeEventListener("keydown", onkey); unlockScroll(); }  // teardown uPlot+RO (sem vazar) · guard = idempotente
    function onkey(e) { if (e.key === "Escape") close(); }
    mw.addEventListener("click", function (e) { var t = e.target; if (t === mw || (t.getAttribute && t.className === "rp-x")) close(); });
    document.addEventListener("keydown", onkey);
    lockScroll();
    document.body.appendChild(mw);
    fetch(ESTUDOS_API + "?key=" + encodeURIComponent(chave) + "&lang=" + (L ? "en" : "pt"), fopt()).then(function (r) { return r.json(); }).then(function (d) {
      var box = mw.querySelector(".rp-est"); if (!box) return;
      if (d.indisponivel || d.erro) { box.innerHTML = head + '<div class="rp-ml" style="margin:6px 0">' + esc(d.definicao || "") + '</div><div class="rp-ml" style="opacity:.7;padding:16px 0;text-align:center">' + (L ? "coming soon" : "em breve") + '</div>'; return; }
      var H = d.horizontes || {}, br = d.base_rate || {}, sgn = function (v) { return (v >= 0 ? "+" : "") + v + "%"; };
      var rowH = function (lbl, o) { return o ? '<tr><td>' + lbl + '</td><td>' + (o.mediana != null ? sgn(o.mediana) : "—") + '</td><td>' + (o.pct_positivo != null ? o.pct_positivo + "%" : "—") + '</td><td>' + (o.p25 != null ? sgn(o.p25) + "…" + sgn(o.p75) : "—") + '</td><td>' + (o.p10 != null ? sgn(o.p10) + "…" + sgn(o.p90) : "—") + '</td></tr>' : ""; };
      var tbl = '<table class="rp-cmptbl est-tbl"><thead><tr><th></th><th>' + (L ? "Median" : "Mediana") + '</th><th>' + (L ? "% up" : "% alta") + '</th><th>' + (L ? "50% band" : "Faixa 50%") + '</th><th>' + (L ? "80% band" : "Faixa 80%") + '</th></tr></thead><tbody>'
        + rowH("3m", H["3m"]) + rowH("6m", H["6m"]) + rowH("12m", H["12m"]) + '</tbody></table>';
      var baseCap = '<div class="rp-ml" style="opacity:.7;margin-top:5px">' + (L ? "vs IBOV base rate: " : "vs taxa-base IBOV: ") + ["3m", "6m", "12m"].map(function (k) { return k + " " + (br[k] ? sgn(br[k].mediana) + "/" + br[k].pct_positivo + "%" : "—"); }).join(" · ") + '</div>';
      box.innerHTML = head
        + '<div class="rp-ml" style="margin:4px 0 9px">' + esc(d.definicao || "") + ' <span style="opacity:.6">· ' + (d.n_episodios || 0) + (L ? " episodes" : " episódios") + ' · ' + esc(d.familia || "") + '</span></div>'
        + tbl + baseCap
        + (d.interpretacao ? '<div class="rp-ml" style="margin-top:12px"><b>' + (L ? "Reading" : "Leitura") + '</b> — ' + esc(d.interpretacao) + '</div>' : '')
        + (d.comparacoes ? '<div class="rp-ml" style="margin-top:6px;opacity:.85"><b>' + (L ? "Compare" : "Comparações") + '</b> — ' + esc(d.comparacoes) + '</div>' : '')
        + (d.nota ? '<div class="rp-ml" style="margin-top:6px;opacity:.55">⚠ ' + esc(d.nota) + '</div>' : '')
        + '<div class="rp-ml" style="margin-top:10px;opacity:.55">' + esc(d.disclaimer || "") + '</div>';
    }).catch(function () { var el = mw.querySelector(".rp-est .rp-ml"); if (el) el.textContent = (L ? "study unavailable" : "estudo indisponível"); });
  }

  // ★ collapse seguro p/ a home (briefing): mostra N itens, recolhe o resto SEM remover (chips seguem cruzáveis + crawler vê tudo). 2 containers do mesmo tipo = layout grid/flex intacto.
  function collapseList(arr, n, klass, moreL) {
    if (!arr.length) return '';
    if (arr.length <= n) return '<div class="' + klass + '">' + arr.join("") + '</div>';
    var rest = arr.slice(n);
    return '<div class="' + klass + '">' + arr.slice(0, n).join("") + '</div>' +
      '<div class="' + klass + ' rp-ov" hidden>' + rest.join("") + '</div>' +
      '<button type="button" class="rp-mtog">+ ' + rest.length + ' ' + esc(moreL) + ' <span style="opacity:.6">⌄</span></button>';
  }
  // ★ Tese viva (briefing: "ganhar mais protagonismo") — extraída p/ render logo após as 5 lentes.
  function rpTeseHTML(rr, L) {
    if (!rr.tese) return '';
    var te = rr.tese, sgs = te.sinais || [], cns = te.cenarios || [];
    var teMore = '<div class="more">' +
      (te.explicacao ? '<div class="mi">' + (L ? "Why — " : "Por que — ") + esc(te.explicacao) + '</div>' : '') +
      (te.mercado ? '<div class="mi"><b>' + (L ? "Market: " : "Mercado: ") + esc(te.mercado) + '</b>' + (te.confianca_mercado ? ' · ' + (L ? "confidence " : "confiança ") + esc(te.confianca_mercado) : '') + ' · ' + esc(te.n_confirma) + (L ? " confirm, " : " confirmam, ") + esc(te.n_contra) + (L ? " contradict" : " contrariam") + (te.evolucao ? ' · ' + esc(te.evolucao) + (L ? " over 3m" : " em 3m") : '') + '</div>' : '') +
      (sgs.length ? '<div class="mi" style="margin-top:4px"><b>' + (L ? "Signals that formed it:" : "Sinais que a formaram:") + '</b></div>' + sgs.map(function (g) { return '<div class="mi">· ' + esc(g.titulo) + (g.orgao ? ' <span style="opacity:.6">(' + esc(g.orgao) + ')</span>' : '') + (g.data ? ' <span style="opacity:.6">' + esc(g.data) + '</span>' : '') + '</div>'; }).join("") : '') +
      (cns.length ? '<div class="mi" style="margin-top:4px"><b>' + (L ? "Scenarios mapped: " : "Cenários mapeados: ") + '</b>' + cns.map(esc).join(" · ") + ' <span style="opacity:.6">' + (L ? "(full in the app)" : "(detalhe no app)") + '</span></div>' : '') + '</div>';
    return '<h4>' + (L ? "Live thesis · why it was calculated" : "Tese viva · por que foi calculada") + '</h4>' +
      '<div class="ln warm" data-exp="1"><div class="lk">' + esc(te.titulo) + ' <span class="lr" style="opacity:.55">＋</span></div><div class="li">' + (L ? "regulatory · confidence " : "regulatório · confiança ") + esc(te.confianca) + ' · ' + esc(te.n_sinais) + (L ? " signals" : " sinais") + '</div><div class="lr">' + (L ? "click to see the provenance" : "clique pra ver a proveniência") + '</div>' + teMore + '</div>' +
      (rr.teses_total > 1 ? '<div class="legend">+ ' + (rr.teses_total - 1) + (L ? " other active theses in the app" : " outras teses ativas no app") + '</div>' : '');
  }
  function render(node, d, lang, sections, chrome, skin) {
    var L = lang === "en";
    var mkt = (node && node.getAttribute) ? (node.getAttribute("data-market") || "") : "";  // ★ embed domain-aware: backlinks p/ .com.br (BR) ou .com (US)
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
    if (chrome) h += '<div class="hd"><a class="brand" href="' + rpBacklink(mkt, lang) + '" target="_blank" rel="noopener" aria-label="Radar Perene">' +
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
      // ★ item 10 pós-B6 (2 grandezas): o clique abre a SÉRIE do número exibido — a breadth (% abaixo do valor-justo,
      //   187 meses em series_historicas_macro) — e não mais o z do ERP (que segue citado no texto como secundário).
      if (g.valuation) { var vl = g.valuation; var erpTxt = vl.erp == null ? "" : ((vl.erp >= 0 ? "+" : "") + vl.erp + "pp"); h += '<div class="i valstrip" data-cod="valuation_breadth_br" data-cls="macro" data-nome="' + esc(L ? "BR valuation breadth (% below fair value)" : "Breadth de valuation BR (% abaixo do valor-justo)") + '"><div class="vl-l"><span class="vl-t">' + (L ? "Valuation BR" : "Valuation BR") + '</span><span class="vl-r">' + esc(vl.regime) + '</span></div><div class="vl-b"><span class="vl-s">' + esc(vl.score) + '%</span> <span class="vl-x">' + (L ? "below fair value" : "abaixo do valor-justo") + (vl.n ? " · " + vl.n + (L ? " stocks" : " ações") : "") + (erpTxt ? " · ERP " + erpTxt : "") + '</span></div></div>'; } }
    if (show("regime") && rr.cambio) { h += '<div class="tk" style="margin-top:8px"><span class="i" data-cod="' + esc(rr.cambio.codigo) + '" data-cls="pulso"><span class="sy">' + esc(rr.cambio.nome) + '</span><span class="pr">R$ ' + esc(rr.cambio.valor) + '</span>' + (rr.cambio.var30 != null ? '<span class="mt">' + (rr.cambio.var30 >= 0 ? "+" : "") + esc(rr.cambio.var30) + '% 30d</span>' : '') + '</span></div>'; }
    if (show("indices") && rr.indices && rr.indices.length) { h += '<h4>' + (L ? "Indices · overview" : "Índices · panorama") + '</h4><div class="legend">' + (L ? "click to chart · + more in the app" : "clique pra ver o gráfico · + outros no app") + '</div><div class="tk">' +
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
        // ★ card do m² (2026-06-11, pedido do dono): cidade · venda R$/m² (DATA) · aluguel (DATA, clicável aninhado —
        //   a delegação acha o data-cod mais próximo) · rendimento · análogo 3m. Payload: rr.imovel_m2 (digest).
        if ((l.key === "imobiliaria" || /imobili/i.test(l.nome || "")) && rr.imovel_m2 && rr.imovel_m2.length) {
          var fD = function (d) { return d ? " · " + String(d).slice(5, 7) + "/" + String(d).slice(0, 4) : ""; };
          am += '<div class="mi" style="margin:7px 0 2px"><b>' + (L ? "Cost per m² (FipeZap)" : "Custo do m² (FipeZap)") + '</b></div><div class="tk">' +
            rr.imovel_m2.map(function (m) {
              var an = m.analogos && m.analogos.venda && m.analogos.venda["3m"];
              var mt = (m.venda != null ? "R$ " + Number(m.venda).toLocaleString(L ? "en-US" : "pt-BR") + "/m²" + fD(m.data) : "") +
                (m.rend != null ? " · " + (L ? "yield " : "rend ") + m.rend + "%" : "") +
                (an && an.med != null ? " · 3m " + (an.med >= 0 ? "+" : "") + an.med + "%" + (an.hit != null ? " (" + an.hit + "%↑)" : "") : "");
              var alug = (m.aluguel != null && m.cod_aluguel) ? '<span data-cod="' + esc(String(m.cod_aluguel).toLowerCase()) + '" data-cls="' + esc(m.cls || "macro") + '" style="text-decoration:underline dotted;cursor:pointer"> · ' + (L ? "rent" : "aluguel") + ' R$ ' + m.aluguel + fD(m.data_aluguel) + '</span>' : "";
              return '<span class="i" data-cod="' + esc(String(m.cod).toLowerCase()) + '" data-cls="' + esc(m.cls || "macro") + '"><span class="sy">' + esc(m.cidade) + '</span><span class="mt">' + mt + alug + '</span></span>';
            }).join("") + '</div><div class="legend">' + (L ? "click the city → dated sale chart · click rent → rent chart · 3m = median analog (hit)" : "clique na cidade → gráfico datado da venda · clique no aluguel → gráfico do aluguel · 3m = análogo mediano (hit)") + '</div>';
        }
        var more = (l.desc || l.indicador_desc || am) ? '<div class="more">' + (l.desc ? '<div class="mi">' + (L ? "The lens — " : "A lente — ") + esc(l.desc) + '</div>' : '') + (l.indicador_desc ? '<div class="mi"><b>' + esc(l.indicador) + ':</b> ' + esc(l.indicador_desc) + '</div>' : '') + am + '</div>' : '';
        return '<div class="ln ' + esc(l.tom) + '"' + (more ? ' data-exp="1"' : '') + '><div class="lk">' + esc(l.nome) + (more ? ' <span class="lr" style="opacity:.55">＋</span>' : '') + '</div><div class="li">' + esc(l.indicador) + '</div>' +
        (l.valor != null ? '<div class="lv">' + esc(l.valor) + (l.unidade ? ' <span class="lr">' + esc(l.unidade) + '</span>' : '') + '</div>' : '') +
        '<div class="lr">' + esc(l.leitura || "") + '</div>' + (l.spark ? spark(l.spark) : '') + more + '</div>'; }).join("") + '</div>'; }
    if (show("tese")) h += rpTeseHTML(rr, L);  // ★ Tese viva — protagonismo (briefing): logo após as 5 lentes. Fase 2: chave própria ("tese") — preset/embed filtrado só a recebe se pedir (o teaser da home pede; um embed "termometros" não carrega a tese regulatória junto)
    // ★ camada 2 (densidade em hierarquia): separa o PRIMÁRIO (regime · 5 lentes · tese) dos indicadores/dados de APOIO.
    //   Só no radar COMPLETO (!sections) — o teaser (regime,lentes) e embeds filtrados não recebem o divisor órfão.
    // ★ Fase 1C — comparar e estudos SAÍRAM da home (2 muros de chips a menos) → abas do drawer. As 3 portas
    //   delicadas mantêm a descoberta (fricção das personas: "ferramentas 6 telas abaixo"); data-tab abre a aba certa.
    //   Contagem VIVA na porta de Mercados (d.cobertura, cresce com o banco) — comunica que os tickers moram aqui.
    if (!sections || show("portas")) h += (!sections ? '<div class="rp-tier2">' + (L ? "Supporting indicators &amp; data" : "Indicadores e dados de apoio") + '</div>' : '')  // Fase 2: preset "exploracao" recebe as portas (chave "portas"); o divisor de camada segue só no radar completo
      + '<div class="rp-portas">'
      + '<button type="button" class="rp-explore" data-tab="mercados">' + (L ? "Explore " : "Explorar ") + (_cob.ativos ? (L ? "all " + _cob.ativos + " assets" : "os " + _cob.ativos + " ativos") : (L ? "all assets" : "todos os ativos")) + ' <span class="a">→</span></button>'
      + '<button type="button" class="rp-explore" data-tab="comparacoes">⚗ ' + (L ? "Compare two assets" : "Comparar dois ativos") + ' <span class="a">→</span></button>'
      + '<button type="button" class="rp-explore" data-tab="estudos">📚 ' + (L ? "Study library" : "Biblioteca de estudos") + ' <span class="a">→</span></button>'
      + '</div>';
    // Fase 1B: macro · ações 1/setor · imóveis SAÍRAM da home → aba "Mercados" do drawer (porta "Explorar →"), p/ tirar o aspecto de screener.
    //   Intermercado, fiscal, análogo e scatter (editoriais) PERMANECEM. As séries do macro/ações/imóveis seguem no catálogo /v1/catalog (Mercados).
    if (show("intermercado") && rr.intermercado_br && rr.intermercado_br.length) { h += '<h4>' + (L ? "Indicators ⇒ BR intermarket" : "Indicadores ⇒ intermercado BR") + '</h4>' +
      collapseList(rr.intermercado_br.map(function (x) { var hasTk = x.tickers && x.tickers.length, xp = x.fonte || hasTk || (x.leadlag && x.leadlag.txt); return '<div class="t ' + esc(x.tom) + '"' + (xp ? ' data-exp="1"' : '') + '><div class="n">' + esc(x.nome) + (xp ? ' <span class="rr" style="opacity:.55">＋</span>' : '') + '</div><div class="rr" style="margin-top:4px">' + esc(x.leitura) + '</div>' + (x.spark2 && x.spark2.a ? '<div class="legend" style="margin-top:5px"><span style="color:var(--_accent)">▬</span> ' + esc(x.spark2.an) + ' <span style="color:var(--_cool)">▬</span> ' + esc(x.spark2.bn) + (x.spark2.c ? ' <span style="color:var(--_warm)">▦</span> ' + esc(x.spark2.cn) : '') + (x.spark2.ar ? '<span style="opacity:.6;display:block;margin-top:1px">' + (L ? "left axis " : "eixo esq ") + esc(fmtNum(x.spark2.ar[0])) + '–' + esc(fmtNum(x.spark2.ar[1])) + ' · ' + (L ? "right axis " : "eixo dir ") + esc(fmtNum(x.spark2.br[0])) + '–' + esc(fmtNum(x.spark2.br[1])) + '</span>' : '') + '</div>' + dualSpark(x.spark2.a, x.spark2.b, x.spark2.c) : '') + (xp ? '<div class="more">' + (x.fonte ? '<div class="mi">' + (L ? "What it is — " : "O que é — ") + esc(x.fonte) + '</div>' : '') + (x.leadlag && x.leadlag.txt ? '<div class="mi"><b>Lead-lag</b> — ' + esc(x.leadlag.txt) + '</div>' : '') + (hasTk ? '<div class="mi" style="margin-bottom:3px">' + (L ? "components (click):" : "componentes (clique):") + '</div><div class="tk">' + x.tickers.map(function (tk) { return '<span class="i" data-cod="' + esc(String(tk.ticker).toLowerCase()) + '" data-cls="' + esc(tk.cls || "equity_br") + '"><span class="sy">' + esc(tk.ticker) + '</span>' + (tk.dy != null ? '<span class="mt">DY ' + esc(tk.dy) + '%</span>' : '') + '</span>'; }).join("") + '</div>' : '') + (x.cod ? '<button class="rp-imxp" data-cod="' + esc(x.cod) + '" data-nome="' + esc(x.numn || x.nome) + '" data-denn="' + esc(x.denn || "IBOV") + '" data-ll="' + esc((x.leadlag && x.leadlag.txt) || x.fonte || "") + '">⤢ ' + (L ? "compare (lead-lag overlay)" : "comparar (overlay lead-lag)") + '</button>' : '') + '</div>' : '') + '</div>'; }), 3, "g3", L ? "more pairs" : "mais pares"); }
    if (show("fiscal") && rr.fiscal && ((rr.fiscal.series && rr.fiscal.series.length) || (rr.fiscal.composicao && rr.fiscal.composicao.length))) {
      h += '<h4>' + (L ? "Fiscal & monetary" : "Fiscal & monetário") + '</h4><div class="legend">' + (L ? "the public accounts behind the regime — debt/GDP, fiscal stress, real rate, Selic; click for the long history" : "as contas públicas por trás do regime — dívida/PIB, stress fiscal, juro real, Selic; clique pra ver a história longa") + '</div>';
      if (rr.fiscal.series && rr.fiscal.series.length) h += '<div class="tk">' + rr.fiscal.series.map(function (x) { return '<span class="i" data-cod="' + esc(x.cod) + '" data-cls="' + esc(x.cls || "macro") + '"><span class="sy">' + esc(x.nome) + '</span><span class="pr">' + esc(x.valor) + (x.unidade ? ' ' + esc(x.unidade) : '') + '</span></span>'; }).join("") + '</div>';
      if (rr.fiscal.composicao && rr.fiscal.composicao.length) {
        h += '<div class="legend" style="margin-top:7px">' + (L ? "Federal public debt by indexer (DPF)" : "Dívida Pública Federal por indexador (DPF)") + '</div><div class="comp">' +
          rr.fiscal.composicao.map(function (c) { return '<span class="seg ' + esc(c.tom || 'neu') + '" style="width:' + c.pct + '%" title="' + esc(c.nome) + ' ' + c.pct + '%"></span>'; }).join("") + '</div><div class="legend">' +
          rr.fiscal.composicao.map(function (c) { return '<span style="white-space:nowrap"><b style="color:var(--_' + esc(c.tom || 'neu') + ')">▮</b> ' + esc(c.nome) + ' ' + c.pct + '%</span>'; }).join(" · ") + '</div>';
      }
    }
    // Tese viva movida p/ logo após as 5 lentes (rpTeseHTML) — protagonismo (briefing)
    if (show("analogo_br") && rr.analogo_br) { var ab = rr.analogo_br; h += '<h4>' + (L ? "BR analog · past → future" : "Análogo BR · passado → futuro") + '</h4><div class="hl"><div class="q">' + esc(ab.pergunta) + '</div>' + (ab.datas_analogas && ab.datas_analogas.length ? '<div class="q" style="margin:-4px 0 8px;color:var(--_accent)">' + (L ? "today resembles " : "hoje lembra ") + esc(ab.datas_analogas.join(" · ")) + '</div>' : '') + '<div class="stat"><div><div class="v">' + (ab.mediana_ret_pct >= 0 ? "+" : "") + esc(ab.mediana_ret_pct) + '%</div><div class="r">' + (L ? "median (IBOV)" : "mediana (IBOV)") + '</div></div><div><div class="v">' + esc(ab.hit_rate_pct) + '%</div><div class="r">hit-rate · n=' + esc(ab.n_analogos) + '</div></div></div>' + (ab.n_analogos && ab.n_analogos < 20 ? '<div class="rp-ml" style="color:var(--_warm);opacity:.9;margin-top:5px">⚠ ' + (L ? "small sample (n=" : "amostra pequena (n=") + esc(ab.n_analogos) + ') · ±' + Math.round(200 * Math.sqrt((ab.hit_rate_pct / 100) * (1 - ab.hit_rate_pct / 100) / ab.n_analogos)) + 'pp — ' + (L ? "wide uncertainty, distribution not a forecast" : "incerteza larga, distribuição não previsão") + '</div>' : '') + '</div>'; }
    if (show("scatter") && rr.regime_scatter && rr.regime_scatter.points) { var sct = rr.regime_scatter; var dist = distChart(sct);
      h += '<h4>' + esc(sct.titulo) + '</h4><div class="legend"><span style="color:var(--_accent)">▮</span> ' + (L ? "today's regime band" : "faixa do regime de hoje") + ' · <span style="color:var(--_warm)">●</span> ' + (L ? "up" : "alta") + ' <span style="color:var(--_cool)">●</span> ' + (L ? "down" : "queda") + ' · ' + (L ? "x = regime · y = IBOV next 6m" : "x = regime · y = IBOV em 6m") + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><div style="flex:1;min-width:230px">' + scatterChart(sct) + '<div class="legend" style="margin-top:3px">' + (L ? "the cloud · today highlighted" : "a nuvem · hoje em destaque") + '</div></div>' +
        (dist ? '<div style="flex:1;min-width:230px">' + dist.svg + '<div class="legend" style="margin-top:3px">' + (L ? "outcomes within today's band (scatter cut — a different method from the k-NN analog above) · most between " : "desfechos na faixa de hoje (recorte do scatter — método distinto do análogo k-NN acima) · maioria entre ") + (dist.p25 >= 0 ? "+" : "") + dist.p25 + '% ' + (L ? "and " : "e ") + (dist.p75 >= 0 ? "+" : "") + dist.p75 + '% (' + (L ? "median " : "mediana ") + (dist.p50 >= 0 ? "+" : "") + dist.p50 + '%, n=' + dist.n + ')</div></div>' : '') +
        '</div>' + (sct.leitura ? '<div class="legend" style="margin-top:4px">' + esc(sct.leitura) + '</div>' : ''); }

    // ════ CÉREBRO 2 — Vértice · experimento (cross-asset, hipótese contextual) ════
    h += brain("Vértice", (L ? "cross-asset · contextual hypothesis" : "cross-asset · hipótese contextual"), true, false);
    // ★ Fase 1D — home mantém top-3 (+3 recolhidos via collapseList); a lista COMPLETA mora na aba Termômetros do
    //   drawer (porta abaixo, só no radar completo — embeds filtrados ficam como estão).
    if (show("termometros") && v.termometros) { var tms = v.termometros.slice().sort(function (p, q) { return Math.abs((q.valor == null ? 50 : q.valor) - 50) - Math.abs((p.valor == null ? 50 : p.valor) - 50); });
      var tCards = tms.slice(0, 6).map(function (t) { var more = (t.desc || t.comp) ? '<div class="more">' + (t.desc ? '<div class="mi">' + esc(t.desc) + '</div>' : '') + (t.comp ? '<div class="mi"><b>' + (L ? "Composed of — " : "Composto por — ") + '</b>' + esc(t.comp) + '</div>' : '') + '</div>' : '';
        return '<div class="t ' + cls(t.valor) + '"' + (more ? ' data-exp="1"' : '') + '><div class="n">' + esc(t.nome) + (more ? ' <span class="rr" style="opacity:.55">＋</span>' : '') + '</div><div class="v">' + (t.valor == null ? "—" : esc(t.valor)) + '</div><div class="rr">' + esc(t.regime) + '</div>' +
        (t.valor != null ? '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, t.valor)) + '%"></i></div>' : '') + more + '</div>'; });
      h += '<h4>' + (L ? "Thermometers · loudest today" : "Termômetros · os mais ativos hoje") + '</h4>' +
      '<div class="legend">' + (L ? "0 = calm · 50 = neutral · 100 = extreme" : "0 = calmo · 50 = neutro · 100 = extremo") + '</div>' +
      collapseList(tCards, 3, "g3", L ? "more thermometers" : "termômetros") +
      (!sections ? '<button type="button" class="rp-explore" data-tab="termometros" style="margin-top:8px">' + (L ? "All " + tms.length + " thermometers" : "Todos os " + tms.length + " termômetros") + ' <span class="a">→</span></button>' : ''); }
    if (show("cripto") && v.cripto && v.cripto.length) { h += '<h4>' + (L ? "Crypto · highlights" : "Cripto · destaques") + '</h4>' + (v.cripto_sentimento ? '<div class="legend">Fear &amp; Greed: ' + esc(v.cripto_sentimento.fng) + ' (' + esc(v.cripto_sentimento.leitura) + ')</div>' : '') + (v.cripto_onchain ? '<div class="legend">' + esc(v.cripto_onchain.nota) + ': ' + [v.cripto_onchain.tvl ? 'TVL ' + esc(v.cripto_onchain.tvl) : '', v.cripto_onchain.stablecoin ? 'stablecoins ' + esc(v.cripto_onchain.stablecoin) : '', v.cripto_onchain.ssr != null ? 'SSR ' + esc(v.cripto_onchain.ssr) : ''].filter(Boolean).join(' · ') + '</div>' : '') + '<div class="tk">' +
      v.cripto.map(function (t) { return '<span class="i" data-cod="' + esc(String(t.simbolo).toLowerCase()) + '" data-cls="cripto"><span class="sy">' + esc(t.simbolo) + '</span><span class="pr">$ ' + esc(t.preco) + '</span>' + (t.pos52 != null ? '<span class="mt">' + esc(t.pos52) + (L ? "% of 52w" : "% da faixa 52s") + '</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (show("extras")) { var ex = [];
      if (v.breadth) { if (v.breadth.us) ex.push(card(L ? "US breadth" : "Breadth US", v.breadth.us.valor + "%", v.breadth.us.regime)); if (v.breadth.br) { var br = v.breadth.br; ex.push(card(L ? "BR breadth · % > 200-day MA" : "Breadth BR · % > média 200d", br.valor + "%", (br.leitura || br.regime) + (br.n ? " · " + br.n + (L ? " names" : " papéis") : ""))); } }
      if (v.geo_riskon) ex.push(card(L ? "Geographic risk-on" : "Risk-on geográfico", v.geo_riskon.valor, v.geo_riskon.regime));
      if (ex.length) h += '<h4>' + (L ? "Market breadth / geographic" : "Amplitude de mercado / geográfico") + '</h4>' +
        '<div class="legend">' + (L ? "% of stocks above their 200-day average · geographic = emerging vs developed rotation" : "% de ações acima da média de 200 dias · geográfico = rotação emergentes vs desenvolvidos") + '</div><div class="g3">' + ex.join("") + '</div>' +
        ((v.breadth && v.breadth.br && v.breadth.br.serie && v.breadth.br.serie.length > 1) ? '<div class="legend" style="margin-top:7px">' + (L ? "BR breadth over time · last 36 months (% > 200-day MA)" : "Breadth BR ao longo do tempo · últimos 36 meses (% > média 200d)") + '</div>' + bigChart({ hist: v.breadth.br.serie }) : ''); }
    if (show("leadlag") && v.lead_lag && v.lead_lag.length) { h += '<h4>' + (L ? "Lead-lag · statistically significant (FDR)" : "Lead-lag · com significância (FDR)") + '</h4>' +
      // ★ glossário no ponto de uso (rodada 50 personas, rec. 6: FDR 49 menções · lead-lag 48 — desistência nº 1 inclusive de quants)
      '<div class="legend">' + (L ? "lead-lag = one series tends to move BEFORE the other (observed lead, in days) · FDR = statistical filter that discards lucky correlations (false-discovery control)" : "lead-lag = uma série costuma se mover ANTES da outra (antecedência observada, em dias) · FDR = filtro estatístico que descarta correlações de sorte (controle de descobertas falsas)") + '</div><ul class="ll">' +
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
      (chrome ? '<br><a href="' + rpBacklink(mkt, lang) + '?utm_source=embed&utm_medium=widget" target="_blank" rel="noopener">' + (L ? "See the full app →" : "Ver o app completo →") + '</a>' : '') + '</div>';
    if (chrome) h += '<div class="ft">' + (d.disclaimer ? esc(d.disclaimer[lang] || d.disclaimer.pt) : "") + ' · ' + (L ? "data by" : "dados de") + ' <a href="' + rpBacklink(mkt, lang) + '" target="_blank" rel="noopener">Radar Perene</a></div>';
    h += '</div>';
    node.innerHTML = h;
  }

  // ★ modo ATIVO ÚNICO (página /ativo/{ticker}) — gráfico rico inline (cone+valor-justo) + readout honesto + "ampliar & manipular" (openBig).
  // Reusa bigChart/openBig; o embed normal não passa por aqui (aditivo, backlink intacto).
  function renderAtivo(node, codigo, classe, lang, skin) {
    var L = lang === "en", cls = "rp" + (skin === "editorial" ? " skin-editorial" : "");
    node.innerHTML = '<div class="' + cls + '"><div class="sub">' + (L ? "loading…" : "carregando…") + '</div></div>';
    fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(codigo) + "&classe=" + encodeURIComponent(classe), fopt())
      .then(function (r) { return r.json(); }).then(function (s) {
        var nm = (codigo || "").toUpperCase();
        if (!s || !s.hist || s.hist.length < 2) { node.innerHTML = '<div class="' + cls + '"><div class="sub">' + (L ? "no data for " : "sem dados para ") + esc(nm) + '</div></div>'; return; }
        var gpaid = rpIsPro();
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
          h += '<div class="rp-ml" style="margin-top:8px"><b>' + (isFii ? (L ? "Net asset value " : "Valor patrimonial ") : "Valuation ") + '</b><b style="color:var(--_warm)">' + (s.fair.premio_pct >= 0 ? "+" : "") + esc(s.fair.premio_pct) + '%</b> ' + (L ? "vs price" : "vs preço") + (isFii ? ' · P/VP ' + esc(s.fair.pvp) : (' · ' + (L ? "P/E " : "P/L ") + esc(s.fair.pe_now) + ' vs ' + esc(s.fair.pe_normal) + (L ? " normal" : " normal"))) + (gpaid ? '' : ' · <span style="opacity:.72">' + lockA(L, '<span style="color:var(--_accent)">🔒</span> ' + (L ? "Valuation line on chart in Founder" : "linha de Valuation no gráfico no Founder")) + '</span>') + '</div>'; }
        else if (s.dcf && s.dcf.iv != null) h += '<div class="rp-ml" style="margin-top:8px"><b>' + (L ? "DCF intrinsic " : "DCF intrínseco ") + '</b>R$ ' + esc(s.dcf.iv) + ' · ' + (L ? "price " : "preço ") + '<b style="color:var(--_' + (s.dcf.premio_pct >= 0 ? "warm" : "cool") + ')">' + (s.dcf.premio_pct >= 0 ? "+" : "") + esc(s.dcf.premio_pct) + '%</b>' + (gpaid ? '' : ' · <span style="opacity:.72">' + lockA(L, '<span style="color:var(--_accent)">🔒</span> ' + (L ? "model & scenarios in Founder" : "modelo & cenários no Founder")) + '</span>') + '</div>';
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
            var _navClampA = null;  // janela navegável permitida (~3a → fim do cone) p/ FREE e Founder (BUG C)
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
                  _navClampA = { min: mn, max: maxFull };  // BUG C: trava a navegação na janela ~3a p/ TODOS (Founder incluso) — coerente com o modal; ver mais = ampliar/trocar período
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
    if (rpWatchTheme._w) return; rpWatchTheme._w = true;  // idempotente: o custom element pode chamar isto fora do boot()
    if (typeof MutationObserver !== "function") return;
    var mo = new MutationObserver(function () { if (uplotOn()) rpRedrawUplots(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  // ★ time-to-insight: um nó SÓ precisa do uPlot se vai desenhar gráfico no render (radar completo, /ativo,
  //   ou seção com gráfico). O teaser (regime,lentes) é texto + sparkline SVG → não deve esperar ~100KB de uPlot.
  function rpNeedsCharts(node) {
    if (node.getAttribute("data-asset")) return true;                 // /ativo → renderAtivo desenha o herói
    var sa = node.getAttribute("data-sections");
    if (!sa) return true;                                             // radar completo (sections=null) desenha gráficos
    var SVG_ONLY = { regime: 1, lentes: 1, indices: 1, tese: 1, portas: 1 };  // seções sem uPlot inline (texto + sparkline SVG)
    return sa.split(",").map(function (s) { return s.trim(); }).filter(Boolean).some(function (s) { return !SVG_ONLY[s]; });
  }
  // ── P0#1: re-render dos widgets quando o plano muda (login resolve /v1/me DEPOIS do 1º render, ou localStorage estava stale).
  //    Sem isto, o Founder logado via o widget travado até dar reload (selo atualizava, widget não). _rpBooted guarda os nós +
  //    params p/ repintar; o listener do rdr-host (window 'rp-premium-change') dispara só na MUDANÇA real de plano (sem churn).
  var _rpBooted = [], _rpLastSig = null;
  // assinatura do estado de render = plano + presença do token. O token importa porque destrava os DADOS no /v1/serie: o
  // Founder que volta já tem localStorage "1" (plano não "transiciona"), mas o token só chega após o /v1/me → a fonte de dados
  // muda e o widget PRECISA repintar (1º fetch foi sem token = teaser). Repintar só quando a assinatura muda evita churn.
  function rpRenderSig() { return (rpIsPro() ? "1" : "0") + ((typeof window !== "undefined" && window.RP_TOKEN) ? "T" : "-"); }
  function rpRerenderAll() {
    _rpBooted.forEach(function (b) {
      if (!b.node || !b.node.isConnected) return;
      if (b.asset) { renderAtivo(b.node, b.asset, b.classe, b.lang, b.skin); return; }  // listener próprio (rp-ob) é re-amarrado no innerHTML novo
      _getDigest(b.lang).then(function (d) { render(b.node, d, b.lang, b.sections, b.chrome, b.skin); }).catch(function () {});  // delegação no nó sobrevive ao innerHTML (não re-amarra)
    });
  }
  function rpOnPremiumChange() { var sig = rpRenderSig(); if (sig === _rpLastSig) return; _rpLastSig = sig; rpRerenderAll(); }  // repinta na mudança de plano OU quando o token destrava os dados
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("rp-premium-change", rpOnPremiumChange);
  // ── lazy-load do uPlot p/ o radar completo abaixo da dobra: IntersectionObserver carrega a engine +
  //    boota o nó SÓ quando ele se aproxima do viewport (rootMargin 800px = pronto quando chega). Fallback
  //    sem IO = comportamento de hoje (carrega já). NÃO se aplica a /ativo (gráfico-herói = eager).
  function rpLazyChart(node) {
    if (typeof IntersectionObserver === "undefined") { ensureUplot(function () { bootNodes([node]); }); return; }
    var io = new IntersectionObserver(function (ents) {
      for (var i = 0; i < ents.length; i++) { if (ents[i].isIntersecting) { io.disconnect(); ensureUplot(function () { bootNodes([node]); }); return; } }
    }, { rootMargin: "800px 0px" });
    io.observe(node);
  }
  // ── idle-warm: esquenta a engine no ocioso (~4s) mesmo sem rolar/clicar → modais instantâneos p/ quem fica
  //    na página, sem bloquear o paint inicial (melhor LCP). Quem sai em <4s economiza o download (casual).
  var _warmed = false;
  function rpIdleWarm() {
    if (_warmed || RP_ENGINE !== "uplot") return; _warmed = true;
    var warm = function () { ensureUplot(function () {}); };
    if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 4000 });
    else setTimeout(warm, 4000);
  }
  function boot() {
    injectStyle();
    rpWatchTheme();
    _rpLastSig = rpRenderSig();  // estado de render no 1º paint → o evento depois só repinta se a assinatura mudar
    var nodes = document.querySelectorAll("#radar-perene,[data-radar-perene]");
    if (!nodes.length) return;
    // teaser (sem-gráfico) pinta JÁ; /ativo (data-asset = herói acima da dobra) carrega a engine eager;
    // radar completo (com-gráfico, sem asset = abaixo da dobra) entra no lazy-load (IO). idle-warm cobre os modais.
    var eager = [], lazy = [], chartless = [];
    [].forEach.call(nodes, function (n) {
      if (!rpNeedsCharts(n)) { chartless.push(n); return; }
      (n.getAttribute("data-asset") ? eager : lazy).push(n);
    });
    if (chartless.length) bootNodes(chartless);
    if (eager.length) ensureUplot(function () { bootNodes(eager); });
    if (lazy.length) lazy.forEach(rpLazyChart);
    rpIdleWarm();  // engine quente p/ cliques/modais (inclusive em página só-teaser), sem bloquear o paint
  }
  function bootNodes(nodes) {
    nodes.forEach(function (node) {
      var lang = node.getAttribute("data-lang") === "en" ? "en" : "pt";
      var chrome = node.getAttribute("data-chrome") !== "off";  // "off" = sem marca/teaser-link/rodapé (uso na própria página)
      var sa = node.getAttribute("data-sections");  // ex.: "regime,macro,termometros,analogo" — vazio = tudo
      var sections = sa ? sa.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : null;
      var skin = node.getAttribute("data-skin") === "editorial" ? "editorial" : null;  // "editorial" = preset quiet-luxury (hairlines, números serif leves, paleta contida) p/ embeds premium
      var asset = node.getAttribute("data-asset");  // ★ modo ATIVO ÚNICO (opt-in, p/ páginas /ativo/{ticker}) — embed normal (SEM data-asset) fica IDÊNTICO, não quebra backlink
      _rpBooted.push({ node: node, lang: lang, sections: sections, chrome: chrome, skin: skin, asset: asset ? asset.trim() : null, classe: node.getAttribute("data-classe") || "equity_br" });  // P0#1: registra p/ repintar no login
      if (asset) { renderAtivo(node, asset.trim(), node.getAttribute("data-classe") || "equity_br", lang, skin); return; }
      // clique num ticker → busca série + projeção e expande a sparkline tríade (interação básica por ticker)
      node.addEventListener("click", function (ev) {
        var t = ev.target, chip = null, exp = null, imxp = null, mtog = null, xpl = null;
        while (t && t !== node) { if (t.getAttribute) { if (!chip && t.getAttribute("data-cod")) chip = t; if (!exp && t.getAttribute("data-exp")) exp = t; if (!imxp && ("" + (t.className || "")).indexOf("rp-imxp") >= 0) imxp = t; if (!mtog && ("" + (t.className || "")).indexOf("rp-mtog") >= 0) mtog = t; if (!xpl && ("" + (t.className || "")).indexOf("rp-explore") >= 0) xpl = t; } t = t.parentNode; }
        if (xpl) { ev.stopPropagation(); rpOpenExplorar(lang, xpl.getAttribute("data-tab") || "mercados"); return; }  // Fase 1B/1C/1D: portas → drawer na aba certa; sobe a árvore (o clique pode cair no <span> da seta). Os branches .rp-cmpbtn/.rp-estbtn saíram com os muros da home — os botões agora vivem nas abas (listeners próprios do pane).
        if (mtog) { ev.stopPropagation(); var ovv = mtog.previousElementSibling; if (ovv && ("" + (ovv.className || "")).indexOf("rp-ov") >= 0) { ovv.removeAttribute("hidden"); mtog.style.display = "none"; } return; }  // ★ "+N mais" → revela os itens recolhidos (one-way)
        if (imxp) {  // ⤢ comparar grande (intermercado) → modal já em compare com o COMPOSTO do setor (numerador) × IBOV
          ev.stopPropagation();
          var icod = imxp.getAttribute("data-cod"), inome = imxp.getAttribute("data-nome") || "Composto", idenn = imxp.getAttribute("data-denn") || "IBOV";
          var ill = imxp.getAttribute("data-ll") || "";  // interpretação lead-lag (risk-on/off) do card → vira legenda no comparativo
          // lead-lag (3 séries do mini-gráfico): numerador + [denominador ≠IBOV (ex. defensivas) OU a RAZÃO ÷IBOV (o sinal)] + IBOV
          var pre = [{ cod: icod, cls: "intermercado", nome: inome }];
          if (idenn && idenn.toUpperCase() !== "IBOV") pre.push({ cod: icod, cls: "intermercado_den", nome: idenn });
          else pre.push({ cod: icod, cls: "intermercado_ratio", nome: inome + "÷IBOV" });  // ÷IBOV: a razão É o sinal lead-lag (faltava)
          pre.push({ cod: "ibov", cls: "pulso", nome: "IBOV" });
          fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(icod) + "&classe=intermercado", fopt())
            .then(function (r) { return r.json(); }).then(function (s0) { if (s0 && s0.hist && s0.hist.length) openBig(s0, inome, ill, lang, null, pre); }).catch(function () { });
          return;
        }
        if (exp && !chip) { exp.classList.toggle("open"); return; }                 // clique na lente/razão → abre/fecha 2ª camada
        if (!chip || chip.getAttribute("data-open")) return;
        chip.setAttribute("data-open", "1"); chip.style.opacity = ".6";
        var rel = chip.getAttribute("data-rel"), fund = chip.getAttribute("data-fund"), meta = rel || "";
        fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(chip.getAttribute("data-cod")) + "&classe=" + encodeURIComponent(chip.getAttribute("data-cls") || "equity_br"), fopt())
          .then(function (r) { return r.json(); }).then(function (s) {
            chip.style.opacity = "";
            var box = document.createElement("span"); box.style.cssText = "flex-basis:100%;width:100%;margin-top:4px";
            var inner = "";
            if (s && s.hist && s.hist.length > 1) {
              var _gp = rpIsPro();  // linha de valor-justo = Founder (free vê só texto)
              var _wS = (serieDiff(s) || (s.stats && s.stats.is_asset === false)) ? (lang === "en" ? "series" : "série") : (lang === "en" ? "price" : "preço");  // 1E p2: subtítulo honesto
              inner += '<span class="mt" style="display:block">' + (lang === "en" ? _wS + " · history → today → projection (dashed)" + (_gp && s.fair ? " · gold = fair value" : "") : _wS + " · histórico → hoje → projeção (tracejada)" + (_gp && s.fair ? " · ouro = valor-justo" : "")) + '</span>' + bigChart({ hist: s.hist, proj: s.proj, cone: s.cone }, { fair: (_gp && s.fair) ? s.fair.serie : null, futFair: (_gp && s.fair) ? s.fair.serie_fut : null });  // bug 5: SÉRIE do fair + cone; fair gated (Founder)
              if (s.fair && s.fair.premio_pct != null) inner += '<span class="mt" style="display:block">' + (lang === "en" ? "fair value " : "valor-justo ") + '<b style="color:var(--_warm)">' + (s.fair.premio_pct >= 0 ? "+" : "") + esc(s.fair.premio_pct) + '%</b> ' + (lang === "en" ? "vs price · P/E now " : "vs preço · P/L hoje ") + esc(s.fair.pe_now) + ' vs ' + esc(s.fair.pe_normal) + (lang === "en" ? " normal" : " normal") + '</span>';
              if (s.dcf && s.dcf.iv != null) inner += '<span class="mt" style="display:block">' + (lang === "en" ? "DCF intrinsic R$ " : "DCF intrínseco R$ ") + esc(s.dcf.iv) + ' · ' + (lang === "en" ? "price " : "preço ") + '<b style="color:var(--_' + (s.dcf.premio_pct >= 0 ? "warm" : "cool") + ')">' + (s.dcf.premio_pct >= 0 ? "+" : "") + esc(s.dcf.premio_pct) + '%</b> · ' + (lang === "en" ? "model, not a forecast" : "modelo, não previsão") + '</span>';
              if (s.risco && s.risco.serie && s.risco.serie.length > 1) inner += '<span class="mt" style="display:block;margin-top:5px">' + (s.mercado_br === false ? (lang === "en" ? "Global risk-on/off (ticks = past extremes)" : "Risco global · risk-on/off (traços = extremos passados)") : (lang === "en" ? "Perene Risk Index · risk-on/off (ticks = past extremes)" : "Índice de Risco Perene · risk-on/off (traços = extremos passados)")) + '</span>' + riskPane(s.risco);
              inner += oscTextLine(s.hist2, s.hist2_label, lang) + oscTextLine(s.hist3, s.hist3_label, lang);  // domínio (FnG/TVL/volume) → texto; stack completo no "ampliar"
            }
            var canBig = s && s.hist && s.hist.length > 1;
            if (canBig) inner += '<button class="rp-zoom" type="button">⤢ ' + (lang === "en" ? "expand chart" : "ampliar gráfico") + '</button>';
            inner += '<span class="mt" style="display:block;margin-top:4px">' + (meta ? esc(meta) + ' · ' : '') + (lang === "en" ? "full in the app →" : "completo no app →") + '</span>';
            box.innerHTML = inner; chip.appendChild(box);
            if (canBig) { var zb = box.querySelector(".rp-zoom"); if (zb) zb.addEventListener("click", function (e) { e.stopPropagation(); var syn = chip.querySelector(".sy"); openBig(s, syn ? syn.textContent : (chip.getAttribute("data-cod") || "").toUpperCase(), meta, lang, fund); }); }
          }).catch(function () { chip.style.opacity = ""; chip.removeAttribute("data-open"); });
      });
      _getDigest(lang)  // ★ promise compartilhada (teaser + completo não duplicam o fetch)
        .then(function (d) { render(node, d, lang, sections, chrome, skin); })
        .catch(function () { node.innerHTML = '<div class="rp"><div class="sub">Radar Perene — indisponível.</div></div>'; });
    });
  }
  // ★ Custom element <radar-perene> — embed de 1 linha (briefing). RETROCOMPATÍVEL: div#radar-perene + iframe radar-embed.html seguem idênticos. Reusa o MESMO render (não duplica lógica).
  //   <radar-perene></radar-perene>                     → digest completo (mercado/idioma pela origem do radar.js)
  //   <radar-perene widget="regime-br"></radar-perene>   → preset de seções
  //   <radar-perene symbol="PETR4"></radar-perene>       → modo ativo único
  //   atributos: lang(pt|en) market(br|us) skin(editorial) chrome(off) sections="a,b" classe(p/ symbol)
  function rpBootOne(inner) { injectStyle(); rpWatchTheme(); if (rpNeedsCharts(inner)) ensureUplot(function () { bootNodes([inner]); }); else { bootNodes([inner]); ensureUplot(function () {}); } }
  if (typeof customElements !== "undefined" && !customElements.get("radar-perene")) {
    try {
      customElements.define("radar-perene", class extends HTMLElement {
        connectedCallback() {
          if (this._rpDone) return; this._rpDone = 1;
          var self = this, inner = document.createElement("div");
          if (!self.style.display) self.style.display = "block";
          ["lang", "market", "skin", "chrome", "sections"].forEach(function (a) { var v = self.getAttribute(a); if (v != null) inner.setAttribute("data-" + a, v); });
          var w = self.getAttribute("widget"); if (w && self.getAttribute("sections") == null && RP_WIDGETS[("" + w).toLowerCase()]) inner.setAttribute("data-sections", RP_WIDGETS[("" + w).toLowerCase()]);
          var sym = self.getAttribute("symbol") || self.getAttribute("ticker"); if (sym) { inner.setAttribute("data-asset", sym); var cl = self.getAttribute("classe"); if (cl) inner.setAttribute("data-classe", cl); }
          self.appendChild(inner);
          rpBootOne(inner);  // boota só o div interno (NÃO tem #radar-perene/[data-radar-perene] → boot() global não duplica)
        }
      });
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
