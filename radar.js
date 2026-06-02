/*! Radar Perene — widget embedável (drop-in, temável, auto-atualiza). MIT-ish: use livre citando a fonte.
 *  Uso em QUALQUER site (HTML, WordPress, React, etc.):
 *    <div id="radar-perene" data-lang="pt"></div>
 *    <script src="https://radarperene.com/radar.js" defer></script>
 *  Identidade própria: defina variáveis CSS no container (ou no :root):
 *    #radar-perene{ --rp-accent:#0aa; --rp-bg:#fff; --rp-txt:#111; --rp-card:#f4f4f4; --rp-line:#e2e2e2; --rp-dim:#666 }
 *  Dado: API pública (CORS aberto). P7: descritivo, nunca recomenda. Atualiza ao carregar a página.
 */
(function () {
  var API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/digest";
  var STYLE_ID = "rp-radar-style";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".rp{--_bg:var(--rp-bg,#faf9f6);--_card:var(--rp-card,#ffffff);--_card2:var(--rp-card2,#f3f1ec);" +
      "--_line:var(--rp-line,#e6e3dc);--_txt:var(--rp-txt,#1a1a2e);--_dim:var(--rp-dim,#6e6e78);" +
      "--_accent:var(--rp-accent,#a8651a);--_hot:var(--rp-hot,#b02e22);--_warm:var(--rp-warm,#7a3b0e);--_cool:var(--rp-cool,#1a3a5c);--_neu:var(--rp-neu,#9c9c96);" +
      "--_font:var(--rp-font,'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif);--_mono:var(--rp-mono,'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace);" +
      "background:var(--_bg);color:var(--_txt);font-family:var(--_font);border:1px solid var(--_line);border-radius:var(--rp-radius,14px);padding:22px;line-height:1.5;max-width:var(--rp-max,880px);margin:0 auto}" +
      ".rp *{box-sizing:border-box}" +
      ".rp h4{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--_dim);margin:16px 0 7px;font-weight:600}" +
      ".rp .g3{display:grid;grid-template-columns:repeat(auto-fit,minmax(116px,1fr));gap:8px}" +
      ".rp .c{background:var(--_card);border:1px solid var(--_line);border-radius:9px;padding:11px}" +
      ".rp .c .k{font-size:10.5px;color:var(--_dim)}.rp .c .b{font-size:20px;font-weight:700;margin-top:2px}.rp .c .r{font-size:10.5px;color:var(--_dim);margin-top:2px}" +
      ".rp .t{background:var(--_card2);border:1px solid var(--_line);border-left:3px solid var(--_neu);border-radius:8px;padding:9px}" +
      ".rp .t.hot{border-left-color:var(--_hot)}.rp .t.warm{border-left-color:var(--_warm)}.rp .t.cool{border-left-color:var(--_cool)}" +
      ".rp .t .n{font-size:11.5px;font-weight:600}.rp .t .v{font-size:17px;font-weight:700}.rp .t .rr{font-size:10px;color:var(--_dim)}" +
      ".rp .chip{display:inline-flex;gap:5px;background:var(--_card2);border:1px solid var(--_line);border-radius:999px;padding:4px 10px;font-size:12px;margin:0 5px 6px 0}.rp .chip b{font-weight:700}.rp .chip .u{color:var(--_dim);font-size:10px}" +
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
      ".rp .ln.hot{border-left-color:var(--_hot)}.rp .ln.warm{border-left-color:var(--_warm)}.rp .ln.cool{border-left-color:var(--_cool)}" +
      ".rp .ln .lk{font-size:11.5px;font-weight:700}.rp .ln .li{font-size:9.5px;color:var(--_dim);margin:2px 0 5px;line-height:1.25;min-height:23px}.rp .ln .lv{font-size:14px;font-weight:700}.rp .ln .lr{font-size:9.5px;color:var(--_dim)}" +
      ".rp ul.ll{margin:6px 0 0;padding:0;list-style:none}.rp ul.ll li{font-size:11.5px;padding:6px 0;border-top:1px solid var(--_line);color:var(--_txt)}.rp ul.ll .tag{color:var(--_dim);font-size:9.5px}" +
      ".rp .tk{display:flex;flex-wrap:wrap;gap:6px}.rp .tk .i{background:var(--_card2);border:1px solid var(--_line);border-radius:7px;padding:5px 9px;font-size:11.5px;display:inline-flex;gap:6px;align-items:baseline}" +
      ".rp .tk .i .sy{font-weight:700}.rp .tk .i .pr{color:var(--_txt)}.rp .tk .i .mt{color:var(--_dim);font-size:9.5px}" +
      ".rp .live{display:flex;align-items:center;gap:7px;font-size:10.5px;color:var(--_dim);margin:0 0 6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.rp .live .dot{width:7px;height:7px;border-radius:50%;background:var(--_accent);flex:none}" +
      ".rp .spk{display:block;width:100%;height:26px;margin-top:7px}" +
      ".rp .bc{display:block;width:100%;height:54px;margin-top:5px;background:var(--_card2);border:1px solid var(--_line);border-radius:6px}.rp .bcx{display:block;font-family:var(--_mono);font-size:9.5px;color:var(--_dim);margin-top:2px}.rp .bcx b{color:var(--_accent)}.rp .bcx .pj{color:var(--_warm)}" +
      ".rp .mg{display:block;margin-top:4px}.rp .mg .nd{animation:rpbreath 3.4s ease-in-out infinite}@keyframes rpbreath{0%,100%{opacity:.45}50%{opacity:1}}@media(prefers-reduced-motion:reduce){.rp .mg .nd{animation:none;opacity:.9}}" +
      ".rp .b,.rp .v,.rp .lv,.rp .vv,.rp .hl .v,.rp .tk .i .pr,.rp .live{font-family:var(--_mono);font-feature-settings:'tnum'}" +
      ".rp .tk .i[data-cod]{cursor:pointer}.rp .tk .i[data-cod]:hover{border-color:var(--_accent)}" +
      ".rp [data-exp]{cursor:pointer}.rp .more{display:none;margin-top:6px;border-top:1px solid var(--_line);padding-top:5px}.rp .open .more{display:block}.rp .more .mi{font-size:10px;color:var(--_dim);padding:2px 0}" +
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
    var s = '<svg class="spk" width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts(a) + '" fill="none" stroke="var(--_accent)" stroke-width="1.4"/><polyline points="' + pts(b) + '" fill="none" stroke="var(--_cool)" stroke-width="1.4"/>';
    if (c && c.length) s += '<polyline points="' + pts(c) + '" fill="none" stroke="var(--_warm)" stroke-width="2" stroke-dasharray="5 2"/>'; // razão = rotação risk-on/off
    return s + '</svg>';
  }
  function fmtNum(v) { var a = Math.abs(v); return a >= 1e9 ? (Math.round(v / 1e8) / 10) + "B" : a >= 1e6 ? (Math.round(v / 1e5) / 10) + "M" : a >= 1e3 ? (Math.round(v / 100) / 10) + "k" : String(Math.round(v * 100) / 100); }
  // gráfico "de verdade" (parâmetros): faixa min/máx, "hoje", projeção tracejada destacada, último valor rotulado
  function bigChart(s) {
    if (!s || !s.hist || s.hist.length < 2) return "";
    var hist = s.hist, proj = (s.proj && s.proj.length > 1) ? s.proj : [], all = hist.concat(proj.slice(1));
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), rng = (mx - mn) || 1;
    var W = 280, H = 60, pL = 3, pR = 4, pT = 6, pB = 6, pw = W - pL - pR, ph = H - pT - pB, tot = all.length - 1 || 1;
    function X(i) { return pL + (i / tot) * pw; } function Y(v) { return pT + (1 - (v - mn) / rng) * ph; }
    var o = '<svg class="bc" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" aria-hidden="true">';
    o += '<line x1="' + pL + '" y1="' + Y(mx).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(mx).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.6"/>';
    o += '<line x1="' + pL + '" y1="' + Y(mn).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(mn).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.6"/>';
    o += '<polyline points="' + hist.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" ") + '" fill="none" stroke="var(--_accent)" stroke-width="1.6"/>';
    if (proj.length) { var nx = X(hist.length - 1);
      o += '<line x1="' + nx.toFixed(1) + '" y1="' + pT + '" x2="' + nx.toFixed(1) + '" y2="' + (H - pB) + '" stroke="var(--_dim)" stroke-width="0.8" stroke-dasharray="1 2"/>';
      o += '<polyline points="' + proj.map(function (v, i) { return X(hist.length - 1 + i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" ") + '" fill="none" stroke="var(--_warm)" stroke-width="1.8" stroke-dasharray="4 2"/>'; }
    return o + '</svg><span class="bcx"><b>' + esc(fmtNum(hist[hist.length - 1])) + '</b> · ↑' + esc(fmtNum(mx)) + ' · ↓' + esc(fmtNum(mn)) + (proj.length ? ' · <span class="pj">⤳ ' + esc(fmtNum(proj[proj.length - 1])) + '</span>' : '') + '</span>';
  }

  function render(node, d, lang, sections, chrome) {
    var L = lang === "en";
    function show(k){ return !sections || sections.indexOf(k) >= 0; }  // data-sections escolhe o que mostrar
    var rr = d.radar || {}, v = d.vertice || {}, h = '<div class="rp">';
    // marca translúcida (branding + backlink) — só nos embeds; data-chrome="off" omite (uso na nossa própria página)
    if (chrome) h += '<div class="hd"><a class="brand" href="https://radarperene.com" target="_blank" rel="noopener" aria-label="Radar Perene">' +
      '<svg width="19" height="19" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.3"/><circle cx="16" cy="16" r="7" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.3"/><line x1="16" y1="16" x2="16" y2="3" stroke="var(--_accent)" stroke-width="1.8"/><circle cx="16" cy="16" r="2.2" fill="var(--_accent)"/></svg>' +
      '<span>Radar <b>Perene</b></span></a><span class="sub">' + (L ? "as of " : "ref. ") + esc(d.data_referencia || "-") + '</span></div>';
    function card(k, sc, r) { return '<div class="c"><div class="k">' + esc(k) + '</div><div class="b">' + (sc == null ? "—" : esc(sc)) + '</div><div class="r">' + esc(r) + '</div></div>'; }
    function brain(n, t, exp, first) { return '<div class="brain' + (first ? ' first' : '') + '"><span class="bn">' + n + '</span><span class="bt">' + t + '</span>' + (exp ? '<span class="bx">' + (L ? "experiment" : "experimento") + '</span>' : '') + '</div>'; }
    // selo de vida honesta: frescor + cobertura datada (estático, sem pulsação — GRAPH §13.5)
    h += '<div class="live"><span class="dot"></span>' + (L ? "updated " : "atualizado em ") + esc(d.data_referencia || "-") +
      ' · ' + (L ? "coverage: 217 assets · 1.2M rows · 29 courts · since 1970" : "cobertura: 217 ativos · 1,2M linhas · 29 tribunais · desde 1970") + '</div>';

    // ════ CÉREBRO 1 — Radar · 5 lentes (regime regulatório, conservador) ════
    h += brain("Radar", (L ? "5 lenses · regulatory regime" : "5 lentes · regime regulatório"), false, true);
    if (show("regime") && rr.regime) { var g = rr.regime; h += '<h4>' + (L ? "Today’s regime" : "Regime de hoje") + '</h4><div class="legend">' + (L ? "0–100 · 50 ≈ neutral · higher = more risk/pressure" : "0–100 · 50 ≈ neutro · quanto maior, mais risco/pressão") + '</div><div class="g3">' +
      card(L ? "Brazil" : "Brasil", (g.brasil || {}).score, (g.brasil || {}).regime) + card("Global", (g.global || {}).score, (g.global || {}).regime) +
      card(L ? "BR intermarket" : "BR intermercado", (g.br_intermercado || {}).score, (g.br_intermercado || {}).regime) + '</div>'; }
    if (rr.cambio) { h += '<div class="tk" style="margin-top:8px"><span class="i" data-cod="' + esc(rr.cambio.codigo) + '" data-cls="pulso"><span class="sy">' + esc(rr.cambio.nome) + '</span><span class="pr">R$ ' + esc(rr.cambio.valor) + '</span>' + (rr.cambio.var30 != null ? '<span class="mt">' + (rr.cambio.var30 >= 0 ? "+" : "") + esc(rr.cambio.var30) + '% 30d</span>' : '') + '</span></div>'; }
    if (rr.indices && rr.indices.length) { h += '<h4>' + (L ? "Indices · overview" : "Índices · panorama") + '</h4><div class="legend">' + (L ? "click to chart · + more in the app" : "clique pra ver o gráfico · + outros no app") + '</div><div class="tk">' +
      rr.indices.map(function (ix) { return '<span class="i" data-cod="' + esc(ix.codigo) + '" data-cls="' + esc(ix.classe) + '"><span class="sy">' + esc(ix.nome) + '</span><span class="pr">' + esc(ix.valor) + '</span>' + (ix.var12m != null ? '<span class="mt">' + (ix.var12m >= 0 ? "+" : "") + esc(ix.var12m) + '% 12m</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (show("lentes") && rr.lentes && rr.lentes.length) { h += '<h4>' + (L ? "The 5 lenses · today" : "As 5 lentes · hoje") + '</h4><div class="legend">' + (L ? "each lens = a domain of Brazil’s regime; color = intensity · dashed line = projection under current conditions, not a forecast" : "cada lente = um domínio do regime; a cor = intensidade · linha tracejada = projeção sob condições atuais, não previsão") + '</div><div class="lns">' +
      rr.lentes.map(function (l) { var more = (l.desc || l.indicador_desc) ? '<div class="more">' + (l.desc ? '<div class="mi">' + (L ? "The lens — " : "A lente — ") + esc(l.desc) + '</div>' : '') + (l.indicador_desc ? '<div class="mi"><b>' + esc(l.indicador) + ':</b> ' + esc(l.indicador_desc) + '</div>' : '') + '</div>' : '';
        return '<div class="ln ' + esc(l.tom) + '"' + (more ? ' data-exp="1"' : '') + '><div class="lk">' + esc(l.nome) + (more ? ' <span class="lr" style="opacity:.55">＋</span>' : '') + '</div><div class="li">' + esc(l.indicador) + '</div>' +
        (l.valor != null ? '<div class="lv">' + esc(l.valor) + (l.unidade ? ' <span class="lr">' + esc(l.unidade) + '</span>' : '') + '</div>' : '') +
        '<div class="lr">' + esc(l.leitura || "") + '</div>' + (l.spark ? spark(l.spark) : '') + more + '</div>'; }).join("") + '</div>'; }
    if (show("macro") && rr.macro_essencial && rr.macro_essencial.length) { h += '<h4>' + (L ? "Indicators behind it · macro" : "Indicadores por trás · macro") + '</h4>' +
      '<div class="legend">' + (L ? "the technical drivers behind the lenses — for those who want to go deeper" : "os motores técnicos por trás das lentes — para quem quer ir fundo") + '</div><div>' +
      rr.macro_essencial.map(function (m) { return '<span class="chip">' + (m.valor != null ? '<b>' + esc(m.valor) + '</b> <span class="u">' + esc(m.unidade) + '</span> ' : '') + esc(m.nome) + (m.leitura ? ' <span class="u">· ' + esc(m.leitura) + '</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (show("intermercado") && rr.intermercado_br && rr.intermercado_br.length) { h += '<h4>' + (L ? "BR intermarket (stocks)" : "Intermercado BR (bolsa)") + '</h4><div class="g3">' +
      rr.intermercado_br.map(function (x) { var hasTk = x.tickers && x.tickers.length, xp = x.fonte || hasTk; return '<div class="t ' + esc(x.tom) + '"' + (xp ? ' data-exp="1"' : '') + '><div class="n">' + esc(x.nome) + (xp ? ' <span class="rr" style="opacity:.55">＋</span>' : '') + '</div><div class="rr" style="margin-top:4px">' + esc(x.leitura) + '</div>' + (x.spark2 && x.spark2.a ? '<div class="legend" style="margin-top:5px"><span style="color:var(--_accent)">▬</span> ' + esc(x.spark2.an) + ' <span style="color:var(--_cool)">▬</span> ' + esc(x.spark2.bn) + (x.spark2.c ? ' <span style="color:var(--_warm)">▦</span> ' + esc(x.spark2.cn) : '') + '</div>' + dualSpark(x.spark2.a, x.spark2.b, x.spark2.c) : '') + (xp ? '<div class="more">' + (x.fonte ? '<div class="mi">' + (L ? "What it is — " : "O que é — ") + esc(x.fonte) + '</div>' : '') + (hasTk ? '<div class="mi" style="margin-bottom:3px">' + (L ? "components (click):" : "componentes (clique):") + '</div><div class="tk">' + x.tickers.map(function (tk) { return '<span class="i" data-cod="' + esc(String(tk.ticker).toLowerCase()) + '" data-cls="equity_br"><span class="sy">' + esc(tk.ticker) + '</span>' + (tk.dy != null ? '<span class="mt">DY ' + esc(tk.dy) + '%</span>' : '') + '</span>'; }).join("") + '</div>' : '') + '</div>' : '') + '</div>'; }).join("") + '</div>'; }
    // tickers por lente (gostinho generoso): ações (V) · Tesouro (M) · FIIs (R)
    if (show("acoes") && rr.tickers_acoes && rr.tickers_acoes.length) { h += '<h4>' + (L ? "BR stocks · highlights" : "Ações BR · destaques") + '</h4><div class="tk">' +
      rr.tickers_acoes.map(function (t) { var rel = (t.razao_nome ? "∈ " + t.razao_nome + (t.razao_leitura ? " · " + t.razao_leitura : "") : "") + (t.risk ? ((t.razao_nome ? " · " : "") + t.risk) : ""); var fund = (t.pl != null ? "P/L " + t.pl : "") + (t.dy != null ? ((t.pl != null ? " · " : "") + "DY " + t.dy + "%") : "") + (t.roe != null ? " · ROE " + t.roe + "%" : ""); return '<span class="i" data-cod="' + esc(String(t.ticker).toLowerCase()) + '" data-cls="equity_br"' + (rel ? ' data-rel="' + esc(rel) + '"' : '') + (fund ? ' data-fund="' + esc(fund) + '"' : '') + '><span class="sy">' + esc(t.ticker) + '</span><span class="pr">R$ ' + esc(t.preco) + '</span>' + (t.pos52 != null ? '<span class="mt">' + esc(t.pos52) + (L ? "% of 52w range" : "% da faixa 52s") + '</span>' : '') + (t.setor ? '<span class="mt">' + esc(t.setor) + '</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (show("tesouro") && rr.tickers_tesouro && rr.tickers_tesouro.length) { h += '<h4>' + (L ? "Treasury (rates)" : "Tesouro Direto (juros)") + '</h4><div class="tk">' +
      rr.tickers_tesouro.map(function (t) { return '<span class="i"' + (t.symbol ? ' data-cod="' + esc(t.symbol) + '" data-cls="tesouro"' : '') + '><span class="sy">' + esc(t.ticker) + '</span><span class="pr">' + esc(t.taxa) + '</span></span>'; }).join("") + '</div>'; }
    if (show("fiis") && rr.tickers_fiis && rr.tickers_fiis.length) { h += '<h4>' + (L ? "REITs (FIIs) · 12m dividend yield" : "FIIs · dividend yield 12m") + '</h4><div class="tk">' +
      rr.tickers_fiis.map(function (t) { return '<span class="i" data-cod="' + esc(String(t.ticker).toLowerCase()) + '" data-cls="pulso"><span class="sy">' + esc(t.ticker) + '</span>' + (t.dy != null ? '<span class="pr">' + esc(t.dy) + '%</span>' : '') + (t.pvp != null ? '<span class="mt">P/VP ' + esc(t.pvp) + (t.pvp < 0.98 ? (L ? " (disc.)" : " (desc.)") : t.pvp > 1.02 ? (L ? " (prem.)" : " (ágio)") : "") + '</span>' : '') + (t.segmento ? '<span class="mt">' + esc(t.segmento) + '</span>' : '') + '</span>'; }).join("") + '</div>'; }

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
    if (show("analogo_br") && rr.analogo_br) { var ab = rr.analogo_br; h += '<h4>' + (L ? "BR analog · past → future" : "Análogo BR · passado → futuro") + '</h4><div class="hl"><div class="q">' + esc(ab.pergunta) + '</div>' + (ab.datas_analogas && ab.datas_analogas.length ? '<div class="q" style="margin:-4px 0 8px;color:var(--_accent)">' + (L ? "today resembles " : "hoje lembra ") + esc(ab.datas_analogas.join(" · ")) + '</div>' : '') + '<div class="stat"><div><div class="v">' + (ab.mediana_ret_pct >= 0 ? "+" : "") + esc(ab.mediana_ret_pct) + '%</div><div class="r">' + (L ? "median (IBOV)" : "mediana (IBOV)") + '</div></div><div><div class="v">' + esc(ab.hit_rate_pct) + '%</div><div class="r">hit-rate</div></div></div></div>'; }

    // ════ CÉREBRO 2 — Vértice · experimento (cross-asset, hipótese contextual) ════
    h += brain("Vértice", (L ? "cross-asset · contextual hypothesis" : "cross-asset · hipótese contextual"), true, false);
    if (show("termometros") && v.termometros) { var tms = v.termometros.slice().sort(function (p, q) { return Math.abs((q.valor == null ? 50 : q.valor) - 50) - Math.abs((p.valor == null ? 50 : p.valor) - 50); }), tShown = tms.slice(0, 6), tRest = tms.length - tShown.length;
      h += '<h4>' + (L ? "Thermometers · loudest today" : "Termômetros · os mais ativos hoje") + '</h4>' +
      '<div class="legend">' + (L ? "0 = calm · 50 = neutral · 100 = extreme" : "0 = calmo · 50 = neutro · 100 = extremo") + (tRest > 0 ? " · +" + tRest + (L ? " more in the app" : " no app") : "") + '</div><div class="g3">' +
      tShown.map(function (t) { return '<div class="t ' + cls(t.valor) + '"><div class="n">' + esc(t.nome) + '</div><div class="v">' + (t.valor == null ? "—" : esc(t.valor)) + '</div><div class="rr">' + esc(t.regime) + '</div>' +
        (t.valor != null ? '<div class="bar"><i style="width:' + Math.max(0, Math.min(100, t.valor)) + '%"></i></div>' : '') + '</div>'; }).join("") + '</div>'; }
    if (show("cripto") && v.cripto && v.cripto.length) { h += '<h4>' + (L ? "Crypto · highlights" : "Cripto · destaques") + '</h4>' + (v.cripto_sentimento ? '<div class="legend">Fear &amp; Greed: ' + esc(v.cripto_sentimento.fng) + ' (' + esc(v.cripto_sentimento.leitura) + ')</div>' : '') + (v.cripto_onchain ? '<div class="legend">' + esc(v.cripto_onchain.nota) + ': ' + [v.cripto_onchain.tvl ? 'TVL ' + esc(v.cripto_onchain.tvl) : '', v.cripto_onchain.stablecoin ? 'stablecoins ' + esc(v.cripto_onchain.stablecoin) : '', v.cripto_onchain.ssr != null ? 'SSR ' + esc(v.cripto_onchain.ssr) : ''].filter(Boolean).join(' · ') + '</div>' : '') + '<div class="tk">' +
      v.cripto.map(function (t) { return '<span class="i" data-cod="' + esc(String(t.simbolo).toLowerCase()) + '" data-cls="cripto"><span class="sy">' + esc(t.simbolo) + '</span><span class="pr">$ ' + esc(t.preco) + '</span>' + (t.pos52 != null ? '<span class="mt">' + esc(t.pos52) + (L ? "% of 52w" : "% da faixa 52s") + '</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (show("extras")) { var ex = [];
      if (v.breadth) { if (v.breadth.us) ex.push(card(L ? "US breadth" : "Breadth US", v.breadth.us.valor + "%", v.breadth.us.regime)); if (v.breadth.br) ex.push(card(L ? "BR breadth" : "Breadth BR", v.breadth.br.valor + "%", v.breadth.br.regime)); }
      if (v.geo_riskon) ex.push(card(L ? "Geographic risk-on" : "Risk-on geográfico", v.geo_riskon.valor, v.geo_riskon.regime));
      if (ex.length) h += '<h4>' + (L ? "Market breadth / geographic" : "Amplitude de mercado / geográfico") + '</h4>' +
        '<div class="legend">' + (L ? "% of stocks above their 200-day average · geographic = emerging vs developed rotation" : "% de ações acima da média de 200 dias · geográfico = rotação emergentes vs desenvolvidos") + '</div><div class="g3">' + ex.join("") + '</div>'; }
    if (show("leadlag") && v.lead_lag && v.lead_lag.length) { h += '<h4>' + (L ? "Lead-lag · statistically significant (FDR)" : "Lead-lag · com significância (FDR)") + '</h4><ul class="ll">' +
      v.lead_lag.map(function (x) { return '<li><b>' + esc(x.leitura) + '</b> <span class="tag">· ' + esc(x.sentido) + ' · corr ' + esc(x.corr) + ' · ' + esc(x.janela_dias) + 'd · FDR ✓</span></li>'; }).join("") + '</ul>'; }
    if (show("analogo") && v.estudo_analogo) { var a = v.estudo_analogo; h += '<h4>' + (L ? "Analog study · past → future" : "Estudo de análogo · passado → futuro") + '</h4><div class="hl"><div class="q">' + esc(a.pergunta) + '</div>' + (a.datas_analogas && a.datas_analogas.length ? '<div class="q" style="margin:-4px 0 8px;color:var(--_accent)">' + (L ? "today resembles " : "hoje lembra ") + esc(a.datas_analogas.join(" · ")) + '</div>' : '') + '<div class="stat">' +
      '<div><div class="v">' + esc(a.mediana_ret_pct) + '%</div><div class="r">' + (L ? "median" : "mediana") + '</div></div>' +
      '<div><div class="v">' + (a.delta_pp >= 0 ? "+" : "") + esc(a.delta_pp) + 'pp</div><div class="r">vs base ' + esc(a.base_rate_pct) + '%</div></div>' +
      '<div><div class="v">' + esc(a.hit_rate_pct) + '%</div><div class="r">hit-rate</div></div></div></div>'; }
    if (show("divergencias") && v.divergencias && v.divergencias.length) { h += '<h4>' + (L ? "Divergences today" : "Divergências hoje") + '</h4><ul class="dv">' +
      v.divergencias.map(function (x) { return '<li><b>' + esc(x.codigo) + '</b> · ' + esc(x.leitura) + '</li>'; }).join("") + '</ul>'; }
    // teaser de profundidade — o avançado SENTE que assinando cruza tudo (sem entregar o core)
    if (show("par") && d.par_curado && d.par_curado.serie_a) { var pc = d.par_curado; h += '<h4>' + (L ? "Curated cross · " : "Cruzamento curado · ") + esc(pc.a) + ' × ' + esc(pc.b) + '</h4><div class="legend"><span style="color:var(--_accent)">▬</span> ' + esc(pc.a) + ' · <span style="color:var(--_cool)">▬</span> ' + esc(pc.b) + ' · ' + esc(pc.nota) + '</div>' + dualSpark(pc.serie_a, pc.serie_b) + '<div class="lr" style="margin-top:4px">' + esc(pc.leitura) + ' <span style="color:var(--_dim)">(corr ' + esc(pc.corr) + ')</span></div>'; }
    h += '<div class="teaser"><b>' + (L ? "This is a sample of the engine." : "Esta é uma amostra do motor.") + '</b> ' +
      (L ? "The full plan adds the provenance of every signal, free cross-analysis of any indicator against any other, historical analogs and projection — across hundreds of assets and 50+ years of history."
         : "O plano completo acrescenta a proveniência de cada sinal, o cruzamento livre de qualquer indicador com qualquer outro, análogos históricos e projeção — sobre centenas de ativos e 50+ anos de histórico.") +
      (chrome ? '<br><a href="https://radarperene.com?utm_source=embed&utm_medium=widget" target="_blank" rel="noopener">' + (L ? "See the full app →" : "Ver o app completo →") + '</a>' : '') + '</div>';
    if (chrome) h += '<div class="ft">' + (d.disclaimer ? esc(d.disclaimer[lang] || d.disclaimer.pt) : "") + ' · ' + (L ? "data by" : "dados de") + ' <a href="https://radarperene.com" target="_blank" rel="noopener">Radar Perene</a></div>';
    h += '</div>';
    node.innerHTML = h;
  }

  function boot() {
    injectStyle();
    var nodes = document.querySelectorAll("#radar-perene,[data-radar-perene]");
    if (!nodes.length) return;
    nodes.forEach(function (node) {
      var lang = node.getAttribute("data-lang") === "en" ? "en" : "pt";
      var chrome = node.getAttribute("data-chrome") !== "off";  // "off" = sem marca/teaser-link/rodapé (uso na própria página)
      var sa = node.getAttribute("data-sections");  // ex.: "regime,macro,termometros,analogo" — vazio = tudo
      var sections = sa ? sa.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : null;
      // clique num ticker → busca série + projeção e expande a sparkline tríade (interação básica por ticker)
      node.addEventListener("click", function (ev) {
        var t = ev.target, chip = null, exp = null;
        while (t && t !== node) { if (t.getAttribute) { if (!chip && t.getAttribute("data-cod")) chip = t; if (!exp && t.getAttribute("data-exp")) exp = t; } t = t.parentNode; }
        if (exp && !chip) { exp.classList.toggle("open"); return; }                 // clique na lente/razão → abre/fecha 2ª camada
        if (!chip || chip.getAttribute("data-open")) return;
        chip.setAttribute("data-open", "1"); chip.style.opacity = ".6";
        var rel = chip.getAttribute("data-rel"), fund = chip.getAttribute("data-fund"), meta = [rel, fund].filter(Boolean).join(" · ");
        fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(chip.getAttribute("data-cod")) + "&classe=" + encodeURIComponent(chip.getAttribute("data-cls") || "equity_br"))
          .then(function (r) { return r.json(); }).then(function (s) {
            chip.style.opacity = "";
            var box = document.createElement("span"); box.style.cssText = "flex-basis:100%;width:100%;margin-top:4px";
            var inner = "";
            if (s && s.hist && s.hist.length > 1) {
              inner += '<span class="mt" style="display:block">' + (lang === "en" ? "price · history → today → projection (dashed)" : "preço · histórico → hoje → projeção (tracejada)") + '</span>' + bigChart({ hist: s.hist, proj: s.proj });
              if (s.hist2 && s.hist2.length > 1) inner += '<span class="mt" style="display:block;margin-top:5px">' + esc(s.hist2_label || "") + '</span>' + bigChart({ hist: s.hist2 });
              if (s.hist3 && s.hist3.length > 1) inner += '<span class="mt" style="display:block;margin-top:5px">' + esc(s.hist3_label || "") + '</span>' + bigChart({ hist: s.hist3 });
            }
            inner += '<span class="mt" style="display:block;margin-top:4px">' + (meta ? esc(meta) + ' · ' : '') + (lang === "en" ? "full in the app →" : "completo no app →") + '</span>';
            box.innerHTML = inner; chip.appendChild(box);
          }).catch(function () { chip.style.opacity = ""; chip.removeAttribute("data-open"); });
      });
      fetch(API + "?lang=" + lang).then(function (r) { return r.json(); })
        .then(function (d) { render(node, d, lang, sections, chrome); })
        .catch(function () { node.innerHTML = '<div class="rp"><div class="sub">Radar Perene — indisponível.</div></div>'; });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
