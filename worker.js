// Cloudflare Worker (static assets) — serve EN-static no domínio .com, inclusive p/ crawler SEM JS.
// Ambos domínios servem o MESMO index.html (PT estático). Só no .com raiz transformamos
// title/meta/OG/FAQ/lang para EN via HTMLRewriter (stream). DEFENSIVO: erro → serve o original.
// run_worker_first está escopado a "/" e "/index.html" → todo o resto serve estático (risco mínimo).

const EN_TITLE = "Radar Perene — Brazil market regime & country risk, read as data";
const EN_DESC = "Brazil's market and regulatory regime, read as data: macro, rates/Selic, country risk, intermarket, FX, REITs and the equity risk premium (earnings yield vs real rate) — across 5 lenses plus the Vertice experiment. Charts with fair value and a scenario cone. Descriptive, public-source, never a recommendation.";
const EN_FAQ = JSON.stringify({
  "@context": "https://schema.org", "@type": "FAQPage", "inLanguage": "en", "mainEntity": [
    { "@type": "Question", "name": "How does Radar Perene compute Brazil's macro regime?", "acceptedAnswer": { "@type": "Answer", "text": "A monthly cross-market sensor outputs a Risk-BR score (0-100) from 8 domestic sub-scores (liquidity, defensive rotation, credit stress and more), calibrated on central-bank expectations (Focus since 2001) and real-rate curves (long NTN-B since 2006), isolating statistically-significant anomalies in 36-month windows." } },
    { "@type": "Question", "name": "What is the Founder price and what changes later?", "acceptedAnswer": { "@type": "Answer", "text": "US$ 149/month (or US$ 1,490/year, 2 months free), locked for your subscription while it stays active, and it includes all five Lenses and the Vertice Experiment. Later the Lenses will be sold a la carte (the Vertice alone will be US$ 290); together they exceed US$ 490/month. Founder secures them all for US$ 149. It is the same product, not a separate premium." } },
    { "@type": "Question", "name": "How do payment and the 7-day window work?", "acceptedAnswer": { "@type": "Answer", "text": "Payment is taken at signup (R$ on .com.br, US$ on .com), processed by Stripe. You have a 7-day full, automatic refund window, a legal right. After 7 days the normal recurrence continues. Cancel anytime in the portal, no human desk." } },
    { "@type": "Question", "name": "How do support, cancellation and data deletion work?", "acceptedAnswer": { "@type": "Answer", "text": "All subscription management, cancellation, refunds, card changes and invoices, is 100% self-service via the Stripe Customer Portal, in one click. Account and data deletion is also one click in your profile; we store nothing beyond your Google/Apple login and email." } },
    { "@type": "Question", "name": "Is this investment advice?", "acceptedAnswer": { "@type": "Answer", "text": "No. Under our P7 protocol the system is strictly descriptive: it reads regimes and anomalies from public sources and never recommends, predicts a price, or gives financial advice." } }
  ]
});

const NARR_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjanRrZ2x0cnhkbmxhY2V6cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTk3MDQsImV4cCI6MjA5NTc5NTcwNH0.CkEmnGCSTfF-9FjjebyeBUFV0-vW6CsfpyBea6cLCUs";
const NARR_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/narrative";
const IND_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/indicadores";
const SNAP_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/snapshot";
const SNAPS_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/snapshots";
const LDD_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/leitura-do-dia";

// escape p/ texto em HTML (defensivo: catálogo é a única fonte, mas nunca confiamos cego)
function _esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function _fetchIndicadores(lang) {
  return fetch(IND_API + "?lang=" + (lang === "en" ? "en" : "pt"),
    { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } });
}
// Página HTML pura, crawlável, autossuficiente — números em texto indexável + JSON-LD (Observation+Dataset).
function _fmtVal(v, u) {  // valor+unidade legível: "percentil 2", "+13%", "-1.47 pp", "38.1/100", "172.285 pontos"
  if (v === null || v === undefined || v === "") return "—";
  u = u || "";
  if (/percentil|pctl/i.test(u)) return "percentil " + Math.round(v);
  if (u === "%") return (v > 0 ? "+" : "") + v + "%";
  if (/^pp$/i.test(u)) return (v > 0 ? "+" : "") + v + " pp";
  if (u === "/100") return v + "/100";
  if (/ponto|pts/i.test(u)) return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " " + u;  // milhar manual (Intl no Worker é limitado)
  return v + (u ? " " + u : "");
}
// ── chrome compartilhado das páginas worker-rendered → casa com a identidade do site (Fraunces/Inter, paleta creme/dourado, tema claro/escuro) ──
function _chromeCss(extra) {
  return '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">' +
    '<style>:root{--bg:#faf9f6;--surface:#fff;--surface2:#f3f1ec;--line:#e6e3dc;--txt:#1a1a2e;--txt2:#3a3a45;--dim:#6e6e78;--gold:#a8651a;--serif:\'Fraunces\',Georgia,serif;--sans:\'Inter\',system-ui,sans-serif;--mono:\'JetBrains Mono\',ui-monospace,monospace;--max:760px}' +
    ':root[data-theme="dark"]{--bg:#0e1217;--surface:#161b22;--surface2:#1c222b;--line:#28303a;--txt:#eceef1;--txt2:#c2c8d0;--dim:#8a929e;--gold:#d9a441}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:var(--sans);line-height:1.6;-webkit-font-smoothing:antialiased;transition:background .2s,color .2s}' +
    '.top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 22px;max-width:var(--max);margin:0 auto}' +
    '.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--txt)}.brand .nm{font-family:var(--serif);font-size:17px;font-weight:600}.brand .nm b{color:var(--gold)}' +
    '.tg{background:none;border:1px solid var(--line);color:var(--dim);border-radius:7px;width:30px;height:30px;cursor:pointer;font-size:13px}' +
    '.wrap{max-width:var(--max);margin:0 auto;padding:6px 22px 30px}' +
    'h1{font-family:var(--serif);font-weight:500;font-size:clamp(23px,4vw,33px);line-height:1.16;letter-spacing:-.01em;margin:14px 0 4px}' +
    'h2{font-family:var(--serif);font-weight:500;font-size:19px;margin:24px 0 6px}' +
    'a{color:var(--gold)}p{color:var(--txt2)}ul{padding-left:1.1rem}li{margin:.35rem 0;color:var(--txt2)}' +
    '.dt{color:var(--dim);font-size:.85rem;margin-bottom:1rem}.nf{color:var(--dim);font-size:.8rem;margin-top:.6rem}' +
    'pre.api{background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:11px 13px;overflow:auto;font-size:12px;font-family:var(--mono);color:var(--txt2)}' +
    'footer{max-width:var(--max);margin:0 auto;padding:20px 22px;border-top:1px solid var(--line);color:var(--dim);font-size:12px}footer a{color:var(--gold)}' +
    (extra || "") + '</style>';
}
function _header() {
  return '<div class="top"><a class="brand" href="/"><svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="color:var(--dim)"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2"/><circle cx="16" cy="16" r="9" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2"/><path d="M16 16 L16 2 A14 14 0 0 1 29 13 Z" fill="#b8801f" fill-opacity="0.2"/><line x1="16" y1="16" x2="16" y2="2" stroke="#b8801f" stroke-width="1.6"/><circle cx="16" cy="16" r="2" fill="#b8801f"/></svg><span class="nm">Radar <b>Perene</b></span></a><button class="tg" id="rp-tg" type="button" aria-label="tema">☾</button></div>';
}
function _themeScript() {
  return '<script>(function(){try{var t=localStorage.getItem("rp-theme");if(t!=="light"&&t!=="dark")t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}var b=document.getElementById("rp-tg");if(b)b.onclick=function(){var c=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",c);try{localStorage.setItem("rp-theme",c);}catch(e){}};})();</script>';
}
function _renderIndicador(ind, dataRef, origin, lang, slug) {
  const en = lang === "en";
  const nome = _esc(ind.nome);
  const valorStr = _esc(_fmtVal(ind.valor, ind.unidade));
  const isPerc = /percentil|pctl/i.test(ind.unidade || "");  // unidade já é percentil → não repete "Percentil histórico"
  const temPerc = !isPerc && ind.percentil !== null && ind.percentil !== undefined && ind.percentil !== "";
  const canon = origin + "/indicador/" + encodeURIComponent(slug);
  const desc = _esc((ind.descricao || ind.leitura || nome)).slice(0, 155);
  const title = nome + " — Radar Perene" + (en ? " · data reading" : " · leitura descritiva");
  const L = en
    ? { cur: "Current reading:", perc: "Historical percentile:", cls: "Classification:", upd: "Last updated:", back: "See the full radar →" }
    : { cur: "Leitura atual:", perc: "Percentil histórico:", cls: "Classificação:", upd: "Última atualização:", back: "Ver o radar completo →" };
  const ld = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "name": ind.nome,
    "description": ind.descricao || ind.leitura || ind.nome,
    "url": canon,
    "inLanguage": en ? "en" : "pt-BR",
    "creator": { "@type": "Organization", "name": "Radar Perene", "url": origin + "/" },
    "isAccessibleForFree": true,
    "datePublished": dataRef || undefined,
    "variableMeasured": {
      "@type": "PropertyValue",
      "name": ind.nome,
      "value": ind.valor,
      "unitText": ind.unidade || undefined,
      "description": ind.leitura || ind.descricao || undefined
    }
  };
  const ldStr = JSON.stringify(ld).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head>" +
    "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + _esc(title) + "</title>" +
    "<meta name=\"description\" content=\"" + desc + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<meta property=\"og:type\" content=\"website\">" +
    "<meta property=\"og:title\" content=\"" + _esc(title) + "\">" +
    "<meta property=\"og:description\" content=\"" + desc + "\">" +
    "<meta property=\"og:url\" content=\"" + canon + "\">" +
    "<meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"https://radarperene.com.br/og.png\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ldStr + "</script>" +
    _chromeCss("h1{font-size:clamp(24px,4vw,32px)}b{color:var(--gold)}p{margin:.5rem 0}.upd{color:var(--dim);font-size:.85rem;margin-top:1.4rem}") +
    "</head><body>" + _header() + "<div class=\"wrap\">" +
    "<h1>" + nome + "</h1>" +
    "<p>" + L.cur + " <b>" + valorStr + "</b></p>" +
    (temPerc ? "<p>" + L.perc + " <b>" + _esc(ind.percentil) + "</b></p>" : "") +
    (ind.classificacao ? "<p>" + L.cls + " " + _esc(ind.classificacao) + "</p>" : "") +
    (ind.leitura ? "<p>" + _esc(ind.leitura) + "</p>" : "") +
    (ind.descricao ? "<p>" + _esc(ind.descricao) + "</p>" : "") +
    "<p class=\"upd\">" + L.upd + " " + _esc(dataRef || "") + "</p>" +
    "</div><footer><a href=\"/\">" + L.back + "</a></footer>" + _themeScript() + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

// ── ARQUIVO DIÁRIO (/diario) — páginas citáveis congeladas + verificação do desfecho ──
function _diarioFetch(url) {
  return fetch(url, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } });
}
function _renderDiarioDia(snap, date, origin, lang, nav) {
  nav = nav || {};
  const en = lang === "en";
  const inds = snap.indicadores || [];
  const narr = snap.narrativa || {};
  const ver = snap.verificacao || null;
  const canon = origin + "/diario/" + date;
  const regime = inds.find(function (i) { return i.slug === "regime-br"; });
  const title = "Radar Perene — " + date + (en ? " · Brazil market regime" : " · regime do mercado BR");
  const desc = _esc(String(narr.resumo || (regime ? regime.leitura : "") || date)).slice(0, 155);
  let verHtml = "";
  if (ver && ver.horizontes && ver.horizontes.length) {
    const lines = ver.horizontes.map(function (h) {
      if (h.status !== "ok") return h.horizonte.toUpperCase() + ": " + (en ? "awaiting " : "aguardando ") + h.alvo;
      let base = h.horizonte.toUpperCase() + ": IBOV " + (h.realizado_pct >= 0 ? "+" : "") + h.realizado_pct + "% (" + _fmtVal(h.ibov_inicio, "pts") + " → " + _fmtVal(h.ibov_fim, "pts") + ")";
      if (h.analogo_previa_pct != null) base += " · " + (en ? "analog predicted " : "análogo previa ") + (h.analogo_previa_pct >= 0 ? "+" : "") + h.analogo_previa_pct + "% → " + (h.direcao_confirmou ? (en ? "direction confirmed" : "direção confirmou") : (en ? "direction did not confirm" : "direção não confirmou"));
      return base;
    });
    verHtml = "<div class=\"ver\"><b>" + (en ? "Verification — outcome vs. the reading" : "Verificação — desfecho vs. a leitura") + "</b><ul>" + lines.map(function (l) { return "<li>" + _esc(l) + "</li>"; }).join("") + "</ul></div>";
  }
  const indHtml = inds.map(function (i) {
    const v = i.valor != null ? " <b>" + _esc(_fmtVal(i.valor, i.unidade)) + "</b>" : "";
    return "<li><a href=\"/indicador/" + _esc(i.slug) + "\">" + _esc(i.nome) + "</a>" + v + (i.leitura ? " — " + _esc(i.leitura) : "") + "</li>";
  }).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "Dataset", "name": title, "description": desc, "url": canon, "inLanguage": en ? "en" : "pt-BR", "datePublished": date, "isAccessibleForFree": true, "creator": { "@type": "Organization", "name": "Radar Perene", "url": origin + "/" } }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + desc + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/diario/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/diario/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com/diario/" + date + "\">" +
    "<meta property=\"og:type\" content=\"article\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + desc + "\"><meta property=\"og:image\" content=\"https://radarperene.com.br/og.png\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    _chromeCss(".ver{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem;margin:1.1rem 0}.ver b{color:var(--txt)}.ver ul{margin:.4rem 0 0}.ctx{font-size:13px;color:var(--dim);margin-top:20px}.cnav{font-size:13px;margin-top:8px;display:flex;justify-content:space-between;gap:12px}") +
    "</head><body>" + _header() + "<div class=\"wrap\">" +
    "<h1>" + (en ? "Brazil market regime — " : "Regime do mercado BR — ") + date + "</h1>" +
    "<p class=\"dt\">" + (en ? "Radar Perene daily snapshot" : "Snapshot diário do Radar Perene") + (snap.frozen === false ? " · " + (en ? "reconstructed essentials" : "essencial reconstruído") : "") + "</p>" +
    verHtml +
    (narr.resumo && snap.frozen === false ? "<p>" + _esc(narr.resumo) + "</p>" : "") +
    "<ul>" + indHtml + "</ul>" +
    "<p class=\"ctx\">" + (en ? "Concepts: " : "Conceitos: ") + "<a href=\"/conceitos/regime-brasil/\">" + (en ? "Brazil Regime" : "Regime Brasil") + "</a> · <a href=\"/conceitos/intermercado-br/\">" + (en ? "Intermarket BR" : "Intermercado BR") + "</a> · <a href=\"/conceitos/analogos-historicos/\">" + (en ? "Historical Analogs" : "Análogos Históricos") + "</a> · " + (en ? "How to read: " : "Como ler: ") + "<a href=\"/como-ler-o-radar/\">" + (en ? "six steps" : "seis passos") + "</a> · <a href=\"/metodologia/\">" + (en ? "Methodology" : "Metodologia") + "</a></p>" +
    ((nav.prev || nav.next) ? "<p class=\"cnav\">" + (nav.prev ? "<a href=\"/diario/" + nav.prev + "\">← " + nav.prev + "</a>" : "<span></span>") + (nav.next ? "<a href=\"/diario/" + nav.next + "\">" + nav.next + " →</a>" : "<span></span>") + "</p>" : "") +
    "</div><footer><a href=\"/diario\">" + (en ? "← all daily readings" : "← todas as leituras diárias") + "</a> · <a href=\"/\">" + (en ? "full radar" : "radar completo") + "</a> · " + (en ? "Descriptive, not a forecast. Public sources." : "Descritivo, não previsão. Fontes públicas.") + "</footer>" +
    _themeScript() + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
function _renderDiarioIndex(data, origin, lang) {
  const en = lang === "en";
  const itens = data.itens || [];
  const canon = origin + "/diario";
  const title = en ? "Daily archive — Radar Perene" : "Arquivo diário — Radar Perene";
  const desc = en ? "Brazil's market-regime reading by Radar Perene, archived daily and citable — see what the Radar showed on each date and what followed." : "A leitura do regime do mercado brasileiro pelo Radar Perene, arquivada todo dia e citável — veja o que o Radar mostrou em cada data e o que se seguiu.";
  const rows = itens.map(function (s) {
    const rg = s.regime_score != null ? (s.regime_score + "/100" + (s.regime_label ? " · " + s.regime_label : "")) : "—";
    return "<li><a href=\"/diario/" + s.data + "\">" + s.data + "</a> — " + _esc(rg) + (s.global ? " · " + (en ? "global " : "global ") + _esc(s.global) : "") + "</li>";
  }).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": canon, "inLanguage": en ? "en" : "pt-BR", "isAccessibleForFree": true }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + _esc(desc) + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/diario\">" +
    "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/diario\">" +
    "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com/diario\">" +
    "<meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:image\" content=\"https://radarperene.com.br/og.png\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    _chromeCss("p.lead{color:var(--txt2);font-size:15px}.cad{font-size:12.5px;color:var(--dim);background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:10px 13px;margin:14px 0}ul.dlist{list-style:none;padding:0}ul.dlist li{padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}ul.dlist li a{font-variant-numeric:tabular-nums;margin-right:6px}") +
    "</head><body>" + _header() + "<div class=\"wrap\"><h1>" + _esc(title) + "</h1><p class=\"lead\">" + _esc(desc) + "</p>" +
    "<p class=\"cad\">" + (en ? "Cadence: monthly (month-end) through 2026-05-30; daily (business days) from then on." : "Cadência: mensal (fim de mês) até 30/05/2026; diária (dias úteis) a partir daí.") + "</p>" +
    "<ul class=\"dlist\">" + rows + "</ul>" +
    "</div><footer><a href=\"/\">" + (en ? "← Full radar" : "← Radar completo") + "</a></footer>" + _themeScript() + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

export default {
  async fetch(request, env) {
    const _url = new URL(request.url);
    const _isEN = /radarperene\.com$/i.test(_url.hostname.toLowerCase()) && !/\.com\.br$/i.test(_url.hostname.toLowerCase());
    // ── /sitemap-ativos.xml — sitemap programático dos /ativo (B.1): a lista REAL (~77), via /v1/tickers ──
    if (_url.pathname === "/sitemap-ativos.xml") {
      try {
        const tr = await fetch(NARR_API.replace("/v1/narrative", "/v1/tickers"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 21600, cacheEverything: true } });
        const tj = tr.ok ? await tr.json() : { ativos: [] };
        const urls = (tj.ativos || []).map(function (t) { return "<url><loc>" + _url.origin + "/ativo/" + t + "</loc><changefreq>daily</changefreq></url>"; }).join("");
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>", { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=21600" } });
      } catch (e) { return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', { headers: { "content-type": "application/xml" } }); }
    }
    // ── /sitemap-indicadores.xml — sitemap programático de /indicador (DATA-DRIVEN): lista REAL via /v1/indicadores ──
    if (_url.pathname === "/sitemap-indicadores.xml") {
      try {
        const ir = await _fetchIndicadores(_isEN ? "en" : "pt");
        const ij = ir.ok ? await ir.json() : { indicadores: [] };
        const urls = (ij.indicadores || []).filter(function (i) { return i && i.slug; }).map(function (i) { return "<url><loc>" + _url.origin + "/indicador/" + encodeURIComponent(i.slug) + "</loc><changefreq>daily</changefreq></url>"; }).join("");
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>", { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
      } catch (e) { return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', { headers: { "content-type": "application/xml" } }); }
    }
    // ── /indicador/{slug} — UMA rota dinâmica p/ QUALQUER indicador (B2 SEO): HTML puro do catálogo único. Indicador novo no catálogo aparece sozinho, sem mexer no worker. ──
    const _im = _url.pathname.match(/^\/indicador\/([a-z0-9-]+)\/?$/);
    if (_im) {
      const slug = _im[1];
      const lang = _isEN ? "en" : "pt";
      try {
        const ir = await _fetchIndicadores(lang);
        if (ir.ok) {
          const ij = await ir.json();
          const ind = (ij.indicadores || []).find(function (i) { return i && i.slug === slug; });
          if (ind) return _renderIndicador(ind, ij.data_referencia, _url.origin, lang, slug);
        }
        // slug fora do catálogo (ou API indisponível) → 404 limpo
        return new Response(lang === "en" ? "Indicator not found." : "Indicador não encontrado.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      } catch (e) {
        return new Response("Not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    }
    // ── /api/leitura-do-dia.json — endpoint público (documentado em /api/docs): proxy do edge, CORS aberto, cache 4h ──
    if (_url.pathname === "/api/leitura-do-dia.json") {
      try {
        const r = await fetch(LDD_API + "?lang=" + (_isEN ? "en" : "pt"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 14400, cacheEverything: true } });
        const body = r.ok ? await r.text() : '{"erro":"indisponivel"}';
        return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=14400", "access-control-allow-origin": "*" } });
      } catch (e) { return new Response('{"erro":"indisponivel"}', { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } }); }
    }
    // ── /sitemap-snapshots.xml — sitemap programático do arquivo diário (/diario): datas reais via /v1/snapshots ──
    if (_url.pathname === "/sitemap-snapshots.xml") {
      try {
        const sr = await _diarioFetch(SNAPS_API);
        const sj = sr.ok ? await sr.json() : { itens: [] };
        const urls = (sj.itens || []).filter(function (s) { return s && s.data; }).map(function (s) { return "<url><loc>" + _url.origin + "/diario/" + s.data + "</loc><changefreq>monthly</changefreq></url>"; }).join("");
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>", { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
      } catch (e) { return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', { headers: { "content-type": "application/xml" } }); }
    }
    // ── /diario — índice cronológico do arquivo diário citável ──
    if (_url.pathname === "/diario") {
      try {
        const r = await _diarioFetch(SNAPS_API + "?lang=" + (_isEN ? "en" : "pt"));
        if (!r.ok) return env.ASSETS.fetch(request);
        return _renderDiarioIndex(await r.json(), _url.origin, _isEN ? "en" : "pt");
      } catch (e) { return env.ASSETS.fetch(request); }
    }
    // ── /diario/{YYYY-MM-DD} — a foto citável congelada daquele dia + verificação do desfecho ──
    const _dm = _url.pathname.match(/^\/diario\/(\d{4}-\d{2}-\d{2})$/);
    if (_dm) {
      try {
        const r = await _diarioFetch(SNAP_API + "?date=" + _dm[1] + "&lang=" + (_isEN ? "en" : "pt"));
        if (!r.ok) return new Response((_isEN ? "No reading for " : "Sem leitura para ") + _dm[1], { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
        const nav = {};  // navegação cronológica (lista desc: idx-1 = mais recente = seguinte; idx+1 = anterior)
        try { const sl = await _diarioFetch(SNAPS_API); if (sl.ok) { const ds = ((await sl.json()).itens || []).map(function (x) { return x.data; }); const ix = ds.indexOf(_dm[1]); if (ix >= 0) { nav.next = ix > 0 ? ds[ix - 1] : null; nav.prev = ix < ds.length - 1 ? ds[ix + 1] : null; } } } catch (e) { /* opcional */ }
        return _renderDiarioDia(await r.json(), _dm[1], _url.origin, _isEN ? "en" : "pt", nav);
      } catch (e) { return env.ASSETS.fetch(request); }
    }
    // ── /ativos — hub crawlável que DE-ORFANIZA as páginas /ativo (Ahrefs #3): links reais via /v1/tickers. 1 rota, língua por hostname. ──
    if (_url.pathname === "/ativos") {
      try {
        const en = _isEN;
        const tr = await fetch(NARR_API.replace("/v1/narrative", "/v1/tickers"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 21600, cacheEverything: true } });
        const tj = tr.ok ? await tr.json() : { ativos: [] };
        const ativos = (tj.ativos || []).map(function (t) { return String(t).toUpperCase(); }).sort();
        const canon = _url.origin + "/ativos";
        const title = en ? "Assets covered — Radar Perene" : "Ativos cobertos — Radar Perene";
        const desc = en ? "Every Brazilian stock, REIT and index with a descriptive Radar Perene reading: price, fair value, regime and historical analogs." : "Todas as ações, FIIs e índices brasileiros com leitura descritiva do Radar Perene: preço, valor-justo, regime e análogos históricos.";
        const links = ativos.map(function (t) { return '<a href="/ativo/' + t.toLowerCase() + '">' + _esc(t) + "</a>"; }).join(" · ");
        const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": canon, "inLanguage": en ? "en" : "pt-BR", "isAccessibleForFree": true }).replace(/</g, "\\u003c");
        const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
          "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + _esc(desc) + "\">" +
          "<link rel=\"canonical\" href=\"" + canon + "\">" +
          "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/ativos\">" +
          "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/ativos\">" +
          "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com/ativos\">" +
          "<meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:image\" content=\"https://radarperene.com.br/og.png\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
          "<script type=\"application/ld+json\">" + ld + "</script>" +
          _chromeCss("p.lead{color:var(--txt2);font-size:15px}.alist a{text-decoration:none;white-space:nowrap;font-family:var(--mono);font-size:13px;line-height:2.1}") +
          "</head><body>" + _header() + "<div class=\"wrap\"><h1>" + _esc(title) + "</h1><p class=\"lead\">" + _esc(desc) + "</p><p class=\"alist\">" + links + "</p></div>" +
          "<footer><a href=\"/\">" + (en ? "&larr; Full radar" : "&larr; Radar completo") + "</a></footer>" + _themeScript() + "</body></html>";
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=21600" } });
      } catch (e) { return env.ASSETS.fetch(request); }
    }
    // ── /ativo/{ticker} — página por ativo (SEO programático B.1): reusa a home shell + widget em modo ativo + narrativa per-ativo ──
    const _am = _url.pathname.match(/^\/ativo\/([a-z0-9]{2,8})\/?$/i);
    if (_am) {
      try {
        const tk = _am[1].toUpperCase();
        const cls = /\d11$/.test(tk) ? "fii" : "equity_br"; // FII = XXXX11
        const lang = _isEN ? "en" : "pt";
        const shell = await env.ASSETS.fetch(new Request(_url.origin + "/"));
        if (!(shell.headers.get("content-type") || "").includes("text/html")) return shell;
        let narr = null;
        try { const nr = await fetch(NARR_API + "?codigo=" + tk + "&classe=" + cls + "&lang=" + lang, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } }); if (nr.ok) narr = await nr.json(); } catch (e) {}
        const titulo = tk + (lang === "en" ? " — Radar Perene · descriptive reading" : " — Radar Perene · leitura descritiva");
        const desc = (narr && narr.resumo) ? narr.resumo.slice(0, 155) : tk;
        let rw = new HTMLRewriter()
          .on("title", { element(e) { e.setInnerContent(titulo); } })
          .on('meta[name="description"]', { element(e) { e.setAttribute("content", desc); } })
          .on('meta[property="og:title"]', { element(e) { e.setAttribute("content", titulo); } })
          .on('meta[property="og:description"]', { element(e) { e.setAttribute("content", desc); } })
          .on("link#rp-canonical", { element(e) { e.setAttribute("href", _url.origin + "/ativo/" + tk.toLowerCase()); } })
          // hreflang self-referente (Ahrefs #4/5): senão herda os do index apontando p/ a home "/"
          .on('link[rel="alternate"][hreflang="pt-br"]', { element(e) { e.setAttribute("href", "https://radarperene.com.br/ativo/" + tk.toLowerCase()); } })
          .on('link[rel="alternate"][hreflang="en"]', { element(e) { e.setAttribute("href", "https://radarperene.com/ativo/" + tk.toLowerCase()); } })
          .on('link[rel="alternate"][hreflang="x-default"]', { element(e) { e.setAttribute("href", "https://radarperene.com/ativo/" + tk.toLowerCase()); } })
          .on("#radar-perene", { element(e) { e.setAttribute("data-asset", tk); e.setAttribute("data-classe", cls); } })
          .on("html", { element(e) { if (_isEN) e.setAttribute("lang", "en"); } });
        if (narr && narr.texto_html) {
          rw = rw.on("#rp-narrative", { element(e) { e.setInnerContent(narr.texto_html, { html: true }); } });
          if (narr.jsonld) { const ld = JSON.stringify(narr.jsonld).replace(/</g, "\\u003c"); rw = rw.on("head", { element(e) { e.append('<script type="application/ld+json">' + ld + '</script>', { html: true }); } }); }
        }
        return rw.transform(shell);
      } catch (e) { /* falha → segue normal */ }
    }
    const res = await env.ASSETS.fetch(request); // serve o asset estático
    try {
      const url = new URL(request.url);
      const host = url.hostname.toLowerCase();
      const isEN = /radarperene\.com$/i.test(host) && !/\.com\.br$/i.test(host); // só .com (não .com.br)
      const isRoot = url.pathname === "/" || url.pathname === "/index.html";
      const ct = res.headers.get("content-type") || "";
      if (!isRoot || !ct.includes("text/html")) return res; // só a home HTML é transformada

      // AI-readability (Sprint A): busca a leitura do dia em prosa (cacheada 1h, DEFENSIVA) p/ injetar como texto + JSON-LD
      let narr = null;
      try {
        const nr = await fetch(NARR_API + "?lang=" + (isEN ? "en" : "pt"),
          { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } });
        if (nr.ok) narr = await nr.json();
      } catch (e) { /* narrativa é opcional — nunca quebra a home */ }

      // Últimas leituras (3 diários mais recentes) → injeta no #rp-ultimas (crawler-first, links pro arquivo)
      let ultimas = null;
      try {
        const ur = await fetch(SNAPS_API + "?lang=" + (isEN ? "en" : "pt"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 14400, cacheEverything: true } });
        if (ur.ok) { const uj = await ur.json(); ultimas = (uj.itens || []).slice(0, 3); }
      } catch (e) { /* opcional */ }

      let rw = new HTMLRewriter();
      if (isEN) {
        rw = rw
          .on("html", { element(e) { e.setAttribute("lang", "en"); } })
          .on("title", { element(e) { e.setInnerContent(EN_TITLE); } })
          .on('meta[name="description"]', { element(e) { e.setAttribute("content", EN_DESC); } })
          .on('meta[property="og:description"]', { element(e) { e.setAttribute("content", EN_DESC); } })
          .on('meta[name="twitter:description"]', { element(e) { e.setAttribute("content", EN_DESC); } })
          .on('meta[property="og:title"]', { element(e) { e.setAttribute("content", EN_TITLE); } })
          .on('meta[name="twitter:title"]', { element(e) { e.setAttribute("content", EN_TITLE); } })
          .on('meta[property="og:locale"]', { element(e) { e.setAttribute("content", "en_US"); } })
          .on('meta[property="og:locale:alternate"]', { element(e) { e.setAttribute("content", "pt_BR"); } })
          .on("#rp-faq-ld", { element(e) { e.setInnerContent(EN_FAQ, { html: true }); } });
      }
      if (narr && narr.texto_html) {
        rw = rw.on("#rp-narrative", { element(e) { e.setInnerContent(narr.texto_html, { html: true }); } });
        if (narr.jsonld) {
          const ld = JSON.stringify(narr.jsonld).replace(/</g, "\u003c"); // seguro dentro de <script>
          rw = rw.on("head", { element(e) { e.append('<script type="application/ld+json">' + ld + '</script>', { html: true }); } });
        }
      }
      if (ultimas && ultimas.length) {
        const uh = ultimas.map(function (s) {
          const rg = s.regime_score != null ? (s.regime_score + "/100" + (s.regime_label ? " · " + s.regime_label : "")) : "—";
          return '<a class="ult" href="/diario/' + s.data + '"><b>' + s.data + '</b>' + _esc(rg) + (s.global ? " · " + (isEN ? "global " : "global ") + _esc(s.global) : "") + " →</a>";
        }).join("");
        rw = rw.on("#rp-ultimas", { element(e) { e.setInnerContent(uh, { html: true }); } });
      }
      return rw.transform(res);
    } catch (e) {
      return res; // nunca quebra: na dúvida, serve o original
    }
  }
};
