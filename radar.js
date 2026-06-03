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
  // anon key pública do Supabase (feita p/ viver no client — vive no bundle de todo site Supabase;
  // o gateway exige um JWT válido, a proteção real é a RLS/função que só expõe o digest curado).
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjanRrZ2x0cnhkbmxhY2V6cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTk3MDQsImV4cCI6MjA5NTc5NTcwNH0.CkEmnGCSTfF-9FjjebyeBUFV0-vW6CsfpyBea6cLCUs";
  var FOPT = { headers: { apikey: ANON, Authorization: "Bearer " + ANON } };
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
      ".rp .rp-zoom{margin-top:6px;border:1px solid var(--_line);background:var(--_card2);color:var(--_accent);border-radius:7px;font-size:10px;padding:3px 9px;cursor:pointer;font-family:var(--rp-font,'Inter',system-ui,sans-serif)}.rp .rp-zoom:hover{border-color:var(--_accent)}" +
      ".rp-mw{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,10,14,.55)}" +
      ".rp-mc{position:relative;max-width:560px!important;width:100%;max-height:88vh;overflow:auto;padding:20px 20px 16px!important;box-shadow:0 18px 60px rgba(0,0,0,.4);cursor:default}" +
      ".rp-mc .rp-x{position:absolute;top:9px;right:12px;border:0;background:transparent;color:var(--_dim);font-size:23px;line-height:1;cursor:pointer;padding:2px 6px}.rp-mc .rp-x:hover{color:var(--_accent)}" +
      ".rp-mc .rp-mt{font-weight:700;font-size:15px;margin:0 28px 2px 0}.rp-mc .rp-ml{font-size:10.5px;color:var(--_dim);margin:5px 0 0;line-height:1.4}.rp-mc .bc.big{height:150px}" +
      ".rp-mc .rp-strip{display:flex;gap:12px;flex-wrap:wrap;margin-top:3px}.rp-mc .rp-st{display:flex;flex-direction:column;font-family:var(--rp-mono,ui-monospace,monospace)}.rp-mc .rp-st b{font-size:13px;line-height:1.1}.rp-mc .rp-st span{font-size:9px;color:var(--_dim)}" +
      ".rp-mc .rp-52{position:relative;height:6px;background:var(--_card2);border:1px solid var(--_line);border-radius:4px;margin-top:4px}.rp-mc .rp-52 i{position:absolute;top:-2px;width:3px;height:10px;background:var(--_accent);border-radius:2px;transform:translateX(-50%)}" +
      ".rp-mc .rp-per{display:flex;gap:5px;margin:7px 0 3px;flex-wrap:wrap}.rp-mc .rp-per button{border:1px solid var(--_line);background:var(--_card2);color:var(--_dim);border-radius:6px;font-size:10px;padding:3px 10px;cursor:pointer;font-family:var(--rp-font,'Inter',system-ui,sans-serif)}.rp-mc .rp-per button.on{border-color:var(--_accent);color:var(--_accent)}.rp-mc .rp-per button.lock{color:var(--_accent);font-weight:600}" +
      ".rp-mc .rp-lock{border:1px dashed var(--_accent);border-radius:10px;padding:18px 16px;text-align:center;background:var(--_card2);min-height:120px;display:flex;flex-direction:column;justify-content:center}.rp-mc .rp-lock b{display:block;font-size:13px;margin-bottom:5px;color:var(--_txt)}.rp-mc .rp-lock small{font-size:10.5px;color:var(--_dim);line-height:1.5}.rp-mc .rp-lock .cta{display:inline-block;margin-top:11px;background:var(--_accent);color:#fff;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;text-decoration:none}" +
      ".rp-mc .rp-chart{position:relative}.rp-mc .rp-xh{position:absolute;top:0;bottom:16px;width:1px;background:var(--_accent);opacity:.55;pointer-events:none;transform:translateX(-0.5px)}.rp-mc .rp-xt{position:absolute;top:0;transform:translateX(-50%);background:var(--_accent);color:#fff;font-size:9px;font-family:var(--rp-mono,ui-monospace,monospace);padding:1px 5px;border-radius:3px;pointer-events:none;white-space:nowrap}" +
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
  function bigChart(s, opt) {
    if (!s || !s.hist || s.hist.length < 2) return "";
    opt = opt || {}; var big = !!opt.big;
    var hist = s.hist;
    var cone = (s.cone && s.cone.mid && s.cone.mid.length > 1) ? s.cone : null;       // cone de quantis (assimétrico, estilo Cowen)
    var proj = (!cone && s.proj && s.proj.length > 1) ? s.proj : [];                   // fallback: projeção linear
    var futN = cone ? (cone.mid.length - 1) : (proj.length ? proj.length - 1 : 0);
    var all = hist.slice();
    if (cone) all = all.concat(cone.lo.slice(1), cone.hi.slice(1)); else if (proj.length) all = all.concat(proj.slice(1));
    var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all), rng = (mx - mn) || 1;
    var W = 280, H = big ? 120 : 60, pL = 3, pR = 4, pT = 6, pB = 6, pw = W - pL - pR, ph = H - pT - pB, tot = (hist.length - 1 + futN) || 1;
    function X(i) { return pL + (i / tot) * pw; } function Y(v) { return pT + (1 - (v - mn) / rng) * ph; }
    var bi = hist.length - 1, nx = X(bi);
    function path(arr, base) { return arr.map(function (v, i) { return X(base + i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" "); }
    var o = '<svg class="bc' + (big ? ' big' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" aria-hidden="true">';
    o += '<line x1="' + pL + '" y1="' + Y(mx).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(mx).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.6"/>';
    o += '<line x1="' + pL + '" y1="' + Y(mn).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(mn).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.6"/>';
    if (s.bands && s.bands.length) { // banding de regime (terminal): faixa de fundo sutil por regime BR
      for (var bd = 0; bd < s.bands.length; bd++) { var b = s.bands[bd], bx0 = X(b.i0), bx1 = X(Math.min(hist.length - 1, (b.i1 || b.i0) + 1));
        o += '<rect x="' + bx0.toFixed(1) + '" y="' + pT + '" width="' + Math.max(0, bx1 - bx0).toFixed(1) + '" height="' + ph.toFixed(1) + '" fill="var(--_' + (b.tom || 'neu') + ')" opacity="0.06"/>'; } }
    if (cone) { // banda p25–p75 (assimétrica) + bordas + mediana tracejada
      var hiPts = cone.hi.map(function (v, i) { return X(bi + i).toFixed(1) + "," + Y(v).toFixed(1); });
      var loRev = cone.lo.map(function (v, i) { return X(bi + i).toFixed(1) + "," + Y(v).toFixed(1); }).reverse();
      o += '<polygon points="' + hiPts.concat(loRev).join(" ") + '" fill="var(--_warm)" opacity="0.13" stroke="none"/>';
      o += '<polyline points="' + path(cone.hi, bi) + '" fill="none" stroke="var(--_warm)" stroke-width="0.6" opacity="0.55"/>';
      o += '<polyline points="' + path(cone.lo, bi) + '" fill="none" stroke="var(--_warm)" stroke-width="0.6" opacity="0.55"/>';
    } else if (proj.length && big) {
      o += '<rect x="' + nx.toFixed(1) + '" y="' + pT + '" width="' + (W - pR - nx).toFixed(1) + '" height="' + ph.toFixed(1) + '" fill="var(--_warm)" opacity="0.07"/>';
    }
    o += '<polyline points="' + hist.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" ") + '" fill="none" stroke="var(--_accent)" stroke-width="' + (big ? 1.2 : 1.6) + '"/>';
    if (cone || proj.length) o += '<line x1="' + nx.toFixed(1) + '" y1="' + pT + '" x2="' + nx.toFixed(1) + '" y2="' + (H - pB) + '" stroke="var(--_dim)" stroke-width="0.8" stroke-dasharray="1 2"/>';
    if (cone) o += '<polyline points="' + path(cone.mid, bi) + '" fill="none" stroke="var(--_warm)" stroke-width="' + (big ? 1.4 : 1.6) + '" stroke-dasharray="4 2"/>';
    else if (proj.length) o += '<polyline points="' + path(proj, bi) + '" fill="none" stroke="var(--_warm)" stroke-width="' + (big ? 1.4 : 1.8) + '" stroke-dasharray="4 2"/>';
    var tail = cone ? (' · <span class="pj">⤳ ' + esc(fmtNum(cone.lo[cone.lo.length - 1])) + '–' + esc(fmtNum(cone.hi[cone.hi.length - 1])) + '</span>') : (proj.length ? ' · <span class="pj">⤳ ' + esc(fmtNum(proj[proj.length - 1])) + '</span>' : '');
    return o + '</svg><span class="bcx"><b>' + esc(fmtNum(hist[hist.length - 1])) + '</b> · ↑' + esc(fmtNum(mx)) + ' · ↓' + esc(fmtNum(mn)) + tail + '</span>';
  }
  // scatter de quadrantes (Lead-Lag): cada ponto = um mês; X=score do regime, Y=retorno do IBOV em 6m; vertical = hoje
  function scatterChart(sc) {
    if (!sc || !sc.points || sc.points.length < 10) return "";
    var pts = sc.points, ys = pts.map(function (p) { return p.y; });
    var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys), yr = (ymax - ymin) || 1;
    var W = 280, H = 150, pL = 4, pR = 4, pT = 6, pB = 6, pw = W - pL - pR, ph = H - pT - pB;
    function X(v) { return pL + (Math.max(0, Math.min(100, v)) / 100) * pw; }
    function Y(v) { return pT + (1 - (v - ymin) / yr) * ph; }
    var o = '<svg class="bc big" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" aria-hidden="true">';
    o += '<line x1="' + X(50).toFixed(1) + '" y1="' + pT + '" x2="' + X(50).toFixed(1) + '" y2="' + (H - pB) + '" stroke="var(--_line)" stroke-width="0.5"/>';
    if (ymin < 0 && ymax > 0) o += '<line x1="' + pL + '" y1="' + Y(0).toFixed(1) + '" x2="' + (W - pR) + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--_line)" stroke-width="0.5"/>';
    o += pts.map(function (p) { return '<rect x="' + (X(p.x) - 1).toFixed(1) + '" y="' + (Y(p.y) - 1).toFixed(1) + '" width="2" height="2" fill="var(--_' + (p.y >= 0 ? "warm" : "cool") + ')" opacity="0.5"/>'; }).join("");
    o += '<line x1="' + X(sc.cur_x).toFixed(1) + '" y1="' + pT + '" x2="' + X(sc.cur_x).toFixed(1) + '" y2="' + (H - pB) + '" stroke="var(--_accent)" stroke-width="1.2" stroke-dasharray="3 2"/>';
    return o + '</svg>';
  }
  // modal "ampliar": gráfico grande (futuro realçado) + complementares + correlações — 3ª camada de profundidade
  function openBig(s, title, meta, lang) {
    if (!s || !s.hist || s.hist.length < 2) return; var L = lang === "en";
    var cur = s.hist[s.hist.length - 1];
    var cone = (s.cone && s.cone.mid && s.cone.mid.length > 1) ? s.cone : null;
    var dp = function (v) { return (v != null && cur) ? Math.round(((v - cur) / Math.abs(cur)) * 1000) / 10 : null; };
    var sgn = function (x) { return (x >= 0 ? "+" : "") + x + "%"; };
    // gate embed-friendly: o widget só LINKA pro fluxo hospedado (login Google/Apple + Stripe vivem no domínio) — funciona de qualquer site (backlink)
    var checkout = (window.RP_CHECKOUT || (L ? "https://radarperene.com/?premium=1" : "https://radarperene.com.br/?premium=1"));
    var chartHTML = function (frac) { var n = s.hist.length, k = Math.max(8, Math.round(n * frac));
      return bigChart({ hist: s.hist.slice(n - k), proj: s.proj, cone: s.cone, bands: (frac >= 0.99 ? s.bands : null) }, { big: true }); };
    var lockHTML = '<div class="rp-lock"><b>' + (L ? "🔒 Full history since 2010 — Founder" : "🔒 Histórico completo desde 2010 — Founder") + '</b><small>' + (L ? "See today's regime against past crises (2015, 2020). Unlock long history, regime anomalies and L3 reports." : "Veja o regime de hoje contra crises passadas (2015, 2020). Desbloqueie o histórico longo, as anomalias de regime e os relatórios L3.") + '</small><a class="cta" href="' + checkout + '" target="_blank" rel="noopener">' + (L ? "Get Founder — US$149/mo →" : "Quero o Founder — R$149/mês →") + '</a></div>';
    var h = '<div class="rp rp-mc" role="dialog" aria-modal="true"><button class="rp-x" aria-label="' + (L ? "close" : "fechar") + '">×</button>';
    h += '<div class="rp-mt">' + esc(title) + '</div>';
    if (s.trend && s.trend.score != null) { var tr = s.trend, sc = tr.score, seg = "";
      var tlab = sc >= 8 ? (L ? "strong uptrend" : "tendência forte") : sc >= 6 ? (L ? "uptrend" : "tendência de alta") : sc >= 4 ? (L ? "neutral" : "neutra") : sc >= 2 ? (L ? "weak" : "tendência fraca") : (L ? "downtrend" : "tendência de baixa");
      for (var si = 0; si < 10; si++) seg += '<span style="display:inline-block;width:8%;height:7px;margin-right:1.5%;border-radius:2px;background:' + (si < sc ? 'var(--_' + (tr.tom || 'neu') + ')' : 'var(--_line)') + '"></span>';
      h += '<div class="rp-ml" style="margin-top:6px"><b>' + (L ? "Trend Score " : "Score de tendência ") + sc + '/10</b> · ' + esc(tlab) + ' <span style="opacity:.6">(' + (L ? "close vs 50/100/200-day MAs, hierarchy, momentum" : "fecho vs médias 50/100/200, hierarquia, momentum") + ')</span></div><div style="margin-top:4px">' + seg + '</div>'; }
    if (s.trend_rel && s.trend_rel.score != null) { var trr = s.trend_rel.score;
      var trl = trr >= 8 ? (L ? "strongly outperforming the IBOV" : "forte vs IBOV") : trr >= 6 ? (L ? "outperforming the IBOV" : "acima do IBOV") : trr >= 4 ? (L ? "in line with the IBOV" : "em linha com o IBOV") : trr >= 2 ? (L ? "lagging the IBOV" : "abaixo do IBOV") : (L ? "strongly lagging the IBOV" : "fraco vs IBOV");
      h += '<div class="rp-ml"><b>' + (L ? "Relative trend vs IBOV " : "Tendência relativa vs IBOV ") + trr + '/10</b> · ' + esc(trl) + ' <span style="opacity:.6">(' + (L ? "the intermarket as a score" : "o intermercado com cara de score") + ')</span></div>'; }
    if (s.stats) { var st = s.stats;
      var labs = st.monthly ? [["m1", "1m"], ["m3", "3m"], ["m6", "6m"], ["y1", "12m"]] : [["d1", "1d"], ["w1", "1sem"], ["m1", "1m"], ["m3", "3m"], ["m6", "6m"], ["y1", "12m"]];
      var cells = labs.map(function (p) { var val = st.ret[p[0]]; if (val == null) return ""; var col = val >= 0 ? "var(--_warm)" : "var(--_cool)"; return '<span class="rp-st"><b style="color:' + col + '">' + (val >= 0 ? "+" : "") + val + '%</b><span>' + esc(L && p[1] === "1sem" ? "1w" : p[1]) + '</span></span>'; }).join("");
      if (cells) h += '<div class="rp-ml" style="margin-top:9px"><b>' + (L ? "Returns" : "Retornos") + '</b></div><div class="rp-strip">' + cells + '</div>';
      if (st.pos52 != null) h += '<div class="rp-ml" style="margin-top:8px">' + (L ? "52-week range · " : "Faixa de 52 semanas · ") + (L ? "low " : "mín ") + esc(fmtNum(st.lo52)) + ' ─ ' + (L ? "high " : "máx ") + esc(fmtNum(st.hi52)) + '</div><div class="rp-52"><i style="left:' + st.pos52 + '%"></i></div><div class="rp-ml" style="opacity:.6">' + (L ? "at " : "em ") + st.pos52 + (L ? "% of range" : "% da faixa") + '</div>';
      h += '<div class="rp-ml" style="margin-top:6px"><b>' + (L ? "Volatility " : "Volatilidade ") + st.vol + '%</b> ' + (L ? "(annualized)" : "(anualizada)") + ' · ' + (L ? "drawdown from peak " : "queda do topo ") + '<b style="color:var(--_cool)">' + st.dd_top + '%</b></div>';
      if (st.sharpe != null) h += '<div class="rp-ml"><b style="color:var(--_' + (st.sharpe >= 0 ? "warm" : "cool") + ')">Sharpe ' + st.sharpe + '</b> · ' + (L ? "risk-adjusted vs Selic " : "risco-ajustado vs Selic ") + st.rf + '% — ' + (st.sharpe >= 0 ? (L ? "beats the risk-free" : "supera a renda fixa") : (L ? "below the risk-free" : "abaixo da renda fixa")) + '</div>'; }
    h += '<div class="rp-ml">' + (cone ? (L ? "price · history → today → fan of analogous outcomes (band p25–median–p75) under current conditions" : "preço · histórico → hoje → leque de desfechos análogos (faixa p25–mediana–p75) sob condições atuais") : (L ? "price · history → today → projection (dashed)" : "preço · histórico → hoje → projeção (tracejada)")) + '</div>';
    h += '<div class="rp-per">' + [["0.33", "3M"], ["0.66", "6M"], ["1", L ? "all" : "tudo"]].map(function (p) { return '<button data-frac="' + p[0] + '"' + (p[0] === "1" ? ' class="on"' : '') + '>' + esc(p[1]) + '</button>'; }).join("") + '<button class="lock" data-max="1">MAX 🔒</button></div>';
    h += '<div class="rp-chart">' + bigChart(s, { big: true }) + '</div>';
    if (cone) { var dlo = dp(cone.lo[cone.lo.length - 1]), dmid = dp(cone.mid[cone.mid.length - 1]), dhi = dp(cone.hi[cone.hi.length - 1]);
      if (dlo != null) h += '<div class="rp-ml"><b style="color:var(--_warm)">' + (L ? "band " : "faixa ") + sgn(dlo) + ' … ' + sgn(dhi) + '</b> · ' + (L ? "median " : "mediana ") + sgn(dmid) + ' · ' + (L ? "empirical distribution of past outcomes — not a forecast" : "distribuição empírica de desfechos passados — não é previsão") + '</div>'; }
    else { var dpct = dp((s.proj && s.proj.length > 1) ? s.proj[s.proj.length - 1] : null);
      if (dpct != null) h += '<div class="rp-ml"><b style="color:var(--_warm)">' + (L ? "projection " : "projeção ") + sgn(dpct) + '</b> · ' + (L ? "linear, under current conditions — not a forecast" : "linear, sob condições atuais — não é previsão") + '</div>'; }
    if (s.hist2 && s.hist2.length > 1) h += '<div class="rp-ml" style="margin-top:9px">' + esc(s.hist2_label || "") + '</div>' + bigChart({ hist: s.hist2 }, { big: true });
    if (s.hist3 && s.hist3.length > 1) h += '<div class="rp-ml" style="margin-top:9px">' + esc(s.hist3_label || "") + '</div>' + bigChart({ hist: s.hist3 }, { big: true });
    if (meta) h += '<div class="rp-ml" style="margin-top:9px">' + (L ? "relation — " : "relação — ") + esc(meta) + '</div>';
    h += '<div class="rp-ml" style="margin-top:9px">' + (L ? "descriptive, never a recommendation · full depth (custom ranges, correlations, scenarios) in the app →" : "descritivo, nunca recomendação · profundidade completa (períodos, correlações, cenários) no app →") + '</div></div>';
    var mw = document.createElement("div"); mw.className = "rp-mw"; mw.innerHTML = h;
    function close() { if (mw.parentNode) mw.parentNode.removeChild(mw); document.removeEventListener("keydown", onkey); }
    function onkey(e) { if (e.key === "Escape") close(); }
    mw.addEventListener("click", function (e) { var t = e.target; if (t === mw || (t.getAttribute && t.getAttribute("aria-label") && t.className === "rp-x")) close(); });
    // seletor de período: janelas livres re-renderizam o gráfico; [MAX 🔒] mostra o gate (login+Stripe hospedado)
    var chartEl = mw.querySelector(".rp-chart"), perBtns = mw.querySelectorAll(".rp-per button");
    var curHist = s.hist;
    var xh = document.createElement("div"); xh.className = "rp-xh"; xh.style.display = "none";
    var xt = document.createElement("div"); xt.className = "rp-xt"; xt.style.display = "none";
    function setChart(frac) {
      curHist = frac >= 0.99 ? s.hist : s.hist.slice(s.hist.length - Math.max(8, Math.round(s.hist.length * frac)));
      chartEl.innerHTML = bigChart({ hist: curHist, proj: s.proj, cone: s.cone, bands: (frac >= 0.99 ? s.bands : null) }, { big: true });
      chartEl.appendChild(xh); chartEl.appendChild(xt);
    }
    setChart(1);
    chartEl.addEventListener("mousemove", function (e) {  // crosshair sincronizado (guia + valor no ponto)
      var rect = chartEl.getBoundingClientRect(), fx = (e.clientX - rect.left) / rect.width;
      if (fx < 0 || fx > 1 || !curHist || curHist.length < 2) { xh.style.display = "none"; xt.style.display = "none"; return; }
      var val = curHist[Math.round(fx * (curHist.length - 1))];
      xh.style.display = "block"; xh.style.left = (fx * 100) + "%";
      xt.style.display = "block"; xt.style.left = (fx * 100) + "%"; xt.textContent = fmtNum(val);
    });
    chartEl.addEventListener("mouseleave", function () { xh.style.display = "none"; xt.style.display = "none"; });
    for (var pi = 0; pi < perBtns.length; pi++) { (function (btn) {
      btn.addEventListener("click", function (e) { e.stopPropagation();
        for (var b = 0; b < perBtns.length; b++) perBtns[b].classList.remove("on"); btn.classList.add("on");
        if (btn.getAttribute("data-max")) { chartEl.innerHTML = lockHTML; return; }
        setChart(parseFloat(btn.getAttribute("data-frac")));
      });
    })(perBtns[pi]); }
    document.addEventListener("keydown", onkey); document.body.appendChild(mw);
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
      rr.lentes.map(function (l) {
        var am = '';
        if (l.amostra && l.amostra.itens && l.amostra.itens.length) {
          am = '<div class="mi" style="margin:5px 0 2px"><b>' + esc(l.amostra.titulo) + '</b></div><div class="tk">' +
            l.amostra.itens.map(function (it) {
              var clk = it.cod ? ' data-cod="' + esc(String(it.cod).toLowerCase()) + '" data-cls="' + esc(it.cls || 'equity_br') + '"' : ' style="cursor:default"';
              return '<span class="i"' + clk + '><span class="sy">' + esc(it.rot) + '</span>' + (it.meta ? '<span class="mt">' + esc(it.meta) + '</span>' : '') + '</span>';
            }).join('') + '</div>' +
            (l.amostra.total && l.amostra.total > l.amostra.itens.length ? '<div class="legend">+ ' + (l.amostra.total - l.amostra.itens.length) + ' ' + esc(l.amostra.nota || (L ? 'in the app' : 'no app')) + '</div>' : '');
        }
        var more = (l.desc || l.indicador_desc || am) ? '<div class="more">' + (l.desc ? '<div class="mi">' + (L ? "The lens — " : "A lente — ") + esc(l.desc) + '</div>' : '') + (l.indicador_desc ? '<div class="mi"><b>' + esc(l.indicador) + ':</b> ' + esc(l.indicador_desc) + '</div>' : '') + am + '</div>' : '';
        return '<div class="ln ' + esc(l.tom) + '"' + (more ? ' data-exp="1"' : '') + '><div class="lk">' + esc(l.nome) + (more ? ' <span class="lr" style="opacity:.55">＋</span>' : '') + '</div><div class="li">' + esc(l.indicador) + '</div>' +
        (l.valor != null ? '<div class="lv">' + esc(l.valor) + (l.unidade ? ' <span class="lr">' + esc(l.unidade) + '</span>' : '') + '</div>' : '') +
        '<div class="lr">' + esc(l.leitura || "") + '</div>' + (l.spark ? spark(l.spark) : '') + more + '</div>'; }).join("") + '</div>'; }
    if (show("macro") && rr.macro_essencial && rr.macro_essencial.length) { h += '<h4>' + (L ? "Indicators behind it · macro" : "Indicadores por trás · macro") + '</h4>' +
      '<div class="legend">' + (L ? "the technical drivers behind the lenses — for those who want to go deeper" : "os motores técnicos por trás das lentes — para quem quer ir fundo") + '</div><div>' +
      rr.macro_essencial.map(function (m) { return '<span class="chip">' + (m.valor != null ? '<b>' + esc(m.valor) + '</b> <span class="u">' + esc(m.unidade) + '</span> ' : '') + esc(m.nome) + (m.leitura ? ' <span class="u">· ' + esc(m.leitura) + '</span>' : '') + '</span>'; }).join("") + '</div>'; }
    if (show("intermercado") && rr.intermercado_br && rr.intermercado_br.length) { h += '<h4>' + (L ? "BR intermarket (stocks)" : "Intermercado BR (bolsa)") + '</h4><div class="g3">' +
      rr.intermercado_br.map(function (x) { var hasTk = x.tickers && x.tickers.length, xp = x.fonte || hasTk || (x.leadlag && x.leadlag.txt); return '<div class="t ' + esc(x.tom) + '"' + (xp ? ' data-exp="1"' : '') + '><div class="n">' + esc(x.nome) + (xp ? ' <span class="rr" style="opacity:.55">＋</span>' : '') + '</div><div class="rr" style="margin-top:4px">' + esc(x.leitura) + '</div>' + (x.spark2 && x.spark2.a ? '<div class="legend" style="margin-top:5px"><span style="color:var(--_accent)">▬</span> ' + esc(x.spark2.an) + ' <span style="color:var(--_cool)">▬</span> ' + esc(x.spark2.bn) + (x.spark2.c ? ' <span style="color:var(--_warm)">▦</span> ' + esc(x.spark2.cn) : '') + (x.spark2.ar ? '<span style="opacity:.6;display:block;margin-top:1px">' + (L ? "left axis " : "eixo esq ") + esc(fmtNum(x.spark2.ar[0])) + '–' + esc(fmtNum(x.spark2.ar[1])) + ' · ' + (L ? "right axis " : "eixo dir ") + esc(fmtNum(x.spark2.br[0])) + '–' + esc(fmtNum(x.spark2.br[1])) + '</span>' : '') + '</div>' + dualSpark(x.spark2.a, x.spark2.b, x.spark2.c) : '') + (xp ? '<div class="more">' + (x.fonte ? '<div class="mi">' + (L ? "What it is — " : "O que é — ") + esc(x.fonte) + '</div>' : '') + (x.leadlag && x.leadlag.txt ? '<div class="mi"><b>Lead-lag</b> — ' + esc(x.leadlag.txt) + '</div>' : '') + (hasTk ? '<div class="mi" style="margin-bottom:3px">' + (L ? "components (click):" : "componentes (clique):") + '</div><div class="tk">' + x.tickers.map(function (tk) { return '<span class="i" data-cod="' + esc(String(tk.ticker).toLowerCase()) + '" data-cls="equity_br"><span class="sy">' + esc(tk.ticker) + '</span>' + (tk.dy != null ? '<span class="mt">DY ' + esc(tk.dy) + '%</span>' : '') + '</span>'; }).join("") + '</div>' : '') + '</div>' : '') + '</div>'; }).join("") + '</div>'; }
    // ações: tira diversa 1-por-setor (com relação risk-on/off). Tesouro (M) e FIIs (R) agora vivem DENTRO das lentes (amostra).
    if (show("acoes") && rr.tickers_acoes && rr.tickers_acoes.length) { h += '<h4>' + (L ? "BR stocks · one per sector" : "Ações BR · 1 por setor") + '</h4><div class="legend">' + (L ? "a diverse cut across sectors — click any for the chart; each lens above opens its own curated 5" : "uma tira diversa por setor — clique pra ver o gráfico; cada lente acima abre os 5 dela") + '</div><div class="tk">' +
      rr.tickers_acoes.map(function (t) { var rel = (t.razao_nome ? "∈ " + t.razao_nome + (t.razao_leitura ? " · " + t.razao_leitura : "") : "") + (t.risk ? ((t.razao_nome ? " · " : "") + t.risk) : ""); var fund = (t.pl != null ? "P/L " + t.pl : "") + (t.dy != null ? ((t.pl != null ? " · " : "") + "DY " + t.dy + "%") : "") + (t.roe != null ? " · ROE " + t.roe + "%" : ""); return '<span class="i" data-cod="' + esc(String(t.ticker).toLowerCase()) + '" data-cls="equity_br"' + (rel ? ' data-rel="' + esc(rel) + '"' : '') + (fund ? ' data-fund="' + esc(fund) + '"' : '') + '><span class="sy">' + esc(t.ticker) + '</span><span class="pr">R$ ' + esc(t.preco) + '</span>' + (t.pos52 != null ? '<span class="mt">' + esc(t.pos52) + (L ? "% of 52w range" : "% da faixa 52s") + '</span>' : '') + (t.setor ? '<span class="mt">' + esc(t.setor) + '</span>' : '') + '</span>'; }).join("") + '</div>'; }
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
    if (show("analogo_br") && rr.analogo_br) { var ab = rr.analogo_br; h += '<h4>' + (L ? "BR analog · past → future" : "Análogo BR · passado → futuro") + '</h4><div class="hl"><div class="q">' + esc(ab.pergunta) + '</div>' + (ab.datas_analogas && ab.datas_analogas.length ? '<div class="q" style="margin:-4px 0 8px;color:var(--_accent)">' + (L ? "today resembles " : "hoje lembra ") + esc(ab.datas_analogas.join(" · ")) + '</div>' : '') + '<div class="stat"><div><div class="v">' + (ab.mediana_ret_pct >= 0 ? "+" : "") + esc(ab.mediana_ret_pct) + '%</div><div class="r">' + (L ? "median (IBOV)" : "mediana (IBOV)") + '</div></div><div><div class="v">' + esc(ab.hit_rate_pct) + '%</div><div class="r">hit-rate</div></div></div></div>'; }
    if (rr.regime_scatter && rr.regime_scatter.points) { var sct = rr.regime_scatter;
      h += '<h4>' + esc(sct.titulo) + '</h4><div class="legend"><span style="color:var(--_accent)">▮</span> ' + (L ? "where we are today" : "onde estamos hoje") + ' · <span style="color:var(--_warm)">▪</span> ' + (L ? "up" : "alta") + ' <span style="color:var(--_cool)">▪</span> ' + (L ? "down" : "queda") + ' · ' + (L ? "x = regime · y = IBOV next 6m" : "x = regime · y = IBOV em 6m") + '</div>' + scatterChart(sct) + (sct.leitura ? '<div class="legend" style="margin-top:4px">' + esc(sct.leitura) + '</div>' : ''); }

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
        fetch(API.replace("/v1/digest", "/v1/serie") + "?codigo=" + encodeURIComponent(chip.getAttribute("data-cod")) + "&classe=" + encodeURIComponent(chip.getAttribute("data-cls") || "equity_br"), FOPT)
          .then(function (r) { return r.json(); }).then(function (s) {
            chip.style.opacity = "";
            var box = document.createElement("span"); box.style.cssText = "flex-basis:100%;width:100%;margin-top:4px";
            var inner = "";
            if (s && s.hist && s.hist.length > 1) {
              inner += '<span class="mt" style="display:block">' + (lang === "en" ? "price · history → today → projection (dashed)" : "preço · histórico → hoje → projeção (tracejada)") + '</span>' + bigChart({ hist: s.hist, proj: s.proj });
              if (s.hist2 && s.hist2.length > 1) inner += '<span class="mt" style="display:block;margin-top:5px">' + esc(s.hist2_label || "") + '</span>' + bigChart({ hist: s.hist2 });
              if (s.hist3 && s.hist3.length > 1) inner += '<span class="mt" style="display:block;margin-top:5px">' + esc(s.hist3_label || "") + '</span>' + bigChart({ hist: s.hist3 });
            }
            var canBig = s && s.hist && s.hist.length > 1;
            if (canBig) inner += '<button class="rp-zoom" type="button">⤢ ' + (lang === "en" ? "expand chart" : "ampliar gráfico") + '</button>';
            inner += '<span class="mt" style="display:block;margin-top:4px">' + (meta ? esc(meta) + ' · ' : '') + (lang === "en" ? "full in the app →" : "completo no app →") + '</span>';
            box.innerHTML = inner; chip.appendChild(box);
            if (canBig) { var zb = box.querySelector(".rp-zoom"); if (zb) zb.addEventListener("click", function (e) { e.stopPropagation(); var syn = chip.querySelector(".sy"); openBig(s, syn ? syn.textContent : (chip.getAttribute("data-cod") || "").toUpperCase(), meta, lang); }); }
          }).catch(function () { chip.style.opacity = ""; chip.removeAttribute("data-open"); });
      });
      fetch(API + "?lang=" + lang, FOPT).then(function (r) { return r.json(); })
        .then(function (d) { render(node, d, lang, sections, chrome); })
        .catch(function () { node.innerHTML = '<div class="rp"><div class="sub">Radar Perene — indisponível.</div></div>'; });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
