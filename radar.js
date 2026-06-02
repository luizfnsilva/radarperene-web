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
      ".rp{--_bg:var(--rp-bg,#0a0c0f);--_card:var(--rp-card,#13171c);--_card2:var(--rp-card2,#171c22);" +
      "--_line:var(--rp-line,#222a31);--_txt:var(--rp-txt,#e8ebee);--_dim:var(--rp-dim,#8b97a3);" +
      "--_accent:var(--rp-accent,#c9a227);--_hot:var(--rp-hot,#e0533d);--_warm:var(--rp-warm,#d98a3d);--_cool:var(--rp-cool,#3d7de0);--_neu:var(--rp-neu,#6b7682);" +
      "--_font:var(--rp-font,'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif);" +
      "background:var(--_bg);color:var(--_txt);font-family:var(--_font);border:1px solid var(--_line);border-radius:var(--rp-radius,14px);padding:22px;line-height:1.5;max-width:var(--rp-max,880px);margin:0 auto}" +
      ".rp *{box-sizing:border-box}" +
      ".rp h4{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--_dim);margin:16px 0 7px;font-weight:600}" +
      ".rp .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}@media(max-width:600px){.rp .g3{grid-template-columns:1fr 1fr}}" +
      ".rp .c{background:var(--_card);border:1px solid var(--_line);border-radius:9px;padding:11px}" +
      ".rp .c .k{font-size:10.5px;color:var(--_dim)}.rp .c .b{font-size:20px;font-weight:700;margin-top:2px}.rp .c .r{font-size:10.5px;color:var(--_dim);margin-top:2px}" +
      ".rp .t{background:var(--_card2);border:1px solid var(--_line);border-left:3px solid var(--_neu);border-radius:8px;padding:9px}" +
      ".rp .t.hot{border-left-color:var(--_hot)}.rp .t.warm{border-left-color:var(--_warm)}.rp .t.cool{border-left-color:var(--_cool)}" +
      ".rp .t .n{font-size:11.5px;font-weight:600}.rp .t .v{font-size:17px;font-weight:700}.rp .t .rr{font-size:10px;color:var(--_dim)}" +
      ".rp .chip{display:inline-flex;gap:5px;background:var(--_card2);border:1px solid var(--_line);border-radius:999px;padding:4px 10px;font-size:12px;margin:0 5px 6px 0}.rp .chip b{font-weight:700}.rp .chip .u{color:var(--_dim);font-size:10px}" +
      ".rp .hl{background:var(--_card2);border:1px solid var(--_accent);border-radius:11px;padding:15px}.rp .hl .q{font-size:12.5px;color:var(--_dim);margin-bottom:8px}.rp .hl .v{font-size:24px;font-weight:800;color:var(--_accent)}.rp .stat{display:flex;gap:18px;flex-wrap:wrap}.rp .stat .r{font-size:11px;color:var(--_dim)}" +
      ".rp ul.dv{margin:6px 0 0;padding:0;list-style:none}.rp ul.dv li{font-size:12px;padding:5px 0;border-top:1px solid var(--_line)}.rp ul.dv b{color:var(--_accent)}" +
      ".rp .hd{display:flex;justify-content:space-between;align-items:baseline}.rp .hd .ttl{font-weight:700}.rp .sub{font-size:11px;color:var(--_dim)}" +
      ".rp .ft{margin-top:14px;font-size:10px;color:var(--_dim);text-align:center}.rp .ft a{color:var(--_accent);text-decoration:none}";
    document.head.appendChild(s);
  }

  function esc(x) { return String(x == null ? "" : x).replace(/[<>&]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]; }); }
  function cls(v) { return v == null ? "" : v >= 75 ? "hot" : v >= 55 ? "warm" : v <= 45 ? "cool" : ""; }
  function clz(z) { return z >= 2 ? "hot" : z >= 1 ? "warm" : z <= -1 ? "cool" : ""; }

  function render(node, d, lang) {
    var L = lang === "en";
    var rr = d.radar || {}, v = d.vertice || {}, h = '<div class="rp">';
    h += '<div class="hd"><span class="ttl">Radar Perene</span><span class="sub">' + (L ? "as of " : "ref. ") + esc(d.data_referencia || "-") + '</span></div>';
    function card(k, sc, r) { return '<div class="c"><div class="k">' + esc(k) + '</div><div class="b">' + (sc == null ? "—" : esc(sc)) + '</div><div class="r">' + esc(r) + '</div></div>'; }
    if (rr.regime) { var g = rr.regime; h += '<h4>' + (L ? "Today’s regime" : "Regime de hoje") + '</h4><div class="g3">' +
      card(L ? "Brazil" : "Brasil", (g.brasil || {}).score, (g.brasil || {}).regime) + card("Global", (g.global || {}).score, (g.global || {}).regime) +
      card(L ? "BR intermarket" : "BR intermercado", (g.br_intermercado || {}).score, (g.br_intermercado || {}).regime) + '</div>'; }
    if (rr.macro_essencial && rr.macro_essencial.length) { h += '<h4>' + (L ? "Essential macro (public)" : "Macro essencial (público)") + '</h4><div>' +
      rr.macro_essencial.map(function (m) { return '<span class="chip"><b>' + esc(m.valor) + '</b> <span class="u">' + esc(m.unidade) + '</span> ' + esc(m.nome) + '</span>'; }).join("") + '</div>'; }
    if (rr.intermercado_br && rr.intermercado_br.length) { h += '<h4>' + (L ? "BR intermarket (stocks)" : "Intermercado BR (bolsa)") + '</h4><div class="g3">' +
      rr.intermercado_br.map(function (x) { return '<div class="t ' + clz(x.z) + '"><div class="n">' + esc(x.nome) + '</div><div class="v">' + (x.z >= 0 ? "+" : "") + esc(x.z) + '</div><div class="rr">z · ' + esc(x.regime) + '</div></div>'; }).join("") + '</div>'; }
    if (v.termometros) { h += '<h4>' + (L ? "9 thermometers" : "9 termômetros") + '</h4><div class="g3">' +
      v.termometros.map(function (t) { return '<div class="t ' + cls(t.valor) + '"><div class="n">' + esc(t.nome) + '</div><div class="v">' + (t.valor == null ? "—" : esc(t.valor)) + '</div><div class="rr">' + esc(t.regime) + '</div></div>'; }).join("") + '</div>'; }
    if (v.estudo_analogo) { var a = v.estudo_analogo; h += '<h4>' + (L ? "Analog study" : "Estudo de análogo") + '</h4><div class="hl"><div class="q">' + esc(a.pergunta) + '</div><div class="stat">' +
      '<div><div class="v">' + esc(a.mediana_ret_pct) + '%</div><div class="r">mediana</div></div>' +
      '<div><div class="v">' + (a.delta_pp >= 0 ? "+" : "") + esc(a.delta_pp) + 'pp</div><div class="r">vs base ' + esc(a.base_rate_pct) + '%</div></div>' +
      '<div><div class="v">' + esc(a.hit_rate_pct) + '%</div><div class="r">hit-rate</div></div></div></div>'; }
    if (v.divergencias && v.divergencias.length) { h += '<h4>' + (L ? "Divergences today" : "Divergências hoje") + '</h4><ul class="dv">' +
      v.divergencias.map(function (x) { return '<li><b>' + esc(x.codigo) + '</b> · ' + esc(x.leitura) + '</li>'; }).join("") + '</ul>'; }
    var ex = [];
    if (v.breadth) { if (v.breadth.us) ex.push(card(L ? "US breadth" : "Breadth US", v.breadth.us.valor + "%", v.breadth.us.regime)); if (v.breadth.br) ex.push(card(L ? "BR breadth" : "Breadth BR", v.breadth.br.valor + "%", v.breadth.br.regime)); }
    if (v.geo_riskon) ex.push(card(L ? "Geographic risk-on" : "Risk-on geográfico", v.geo_riskon.valor, v.geo_riskon.regime));
    if (ex.length) h += '<h4>' + (L ? "Breadth / geographic" : "Breadth / geográfico") + '</h4><div class="g3">' + ex.join("") + '</div>';
    h += '<div class="ft">' + (d.disclaimer ? esc(d.disclaimer[lang] || d.disclaimer.pt) : "") + ' <a href="https://radarperene.com" target="_blank" rel="noopener">radarperene.com</a></div>';
    h += '</div>';
    node.innerHTML = h;
  }

  function boot() {
    injectStyle();
    var nodes = document.querySelectorAll("#radar-perene,[data-radar-perene]");
    if (!nodes.length) return;
    nodes.forEach(function (node) {
      var lang = node.getAttribute("data-lang") === "en" ? "en" : "pt";
      fetch(API + "?lang=" + lang).then(function (r) { return r.json(); })
        .then(function (d) { render(node, d, lang); })
        .catch(function () { node.innerHTML = '<div class="rp"><div class="sub">Radar Perene — indisponível.</div></div>'; });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
