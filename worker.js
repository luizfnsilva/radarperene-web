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

// escape p/ texto em HTML (defensivo: catálogo é a única fonte, mas nunca confiamos cego)
function _esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function _fetchIndicadores(lang) {
  return fetch(IND_API + "?lang=" + (lang === "en" ? "en" : "pt"),
    { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } });
}
// Página HTML pura, crawlável, autossuficiente — números em texto indexável + JSON-LD (Observation+Dataset).
function _renderIndicador(ind, dataRef, origin, lang, slug) {
  const en = lang === "en";
  const nome = _esc(ind.nome);
  const unidade = _esc(ind.unidade || "");
  const valorStr = _esc(ind.valor) + unidade;
  const temPerc = ind.percentil !== null && ind.percentil !== undefined && ind.percentil !== "";
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
    "<meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\">" +
    "<script type=\"application/ld+json\">" + ldStr + "</script>" +
    "<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:46rem;margin:0 auto;padding:2.5rem 1.25rem;color:#1a1a2e;background:#fafafc;line-height:1.6}h1{font-size:1.65rem;margin:0 0 1rem}b{color:#0b3d91}p{margin:.5rem 0}a{color:#0b3d91}.upd{color:#666;font-size:.85rem;margin-top:1.5rem}</style>" +
    "</head><body>" +
    "<h1>" + nome + "</h1>" +
    "<p>" + L.cur + " <b>" + valorStr + "</b></p>" +
    (temPerc ? "<p>" + L.perc + " <b>" + _esc(ind.percentil) + "</b></p>" : "") +
    (ind.classificacao ? "<p>" + L.cls + " " + _esc(ind.classificacao) + "</p>" : "") +
    (ind.leitura ? "<p>" + _esc(ind.leitura) + "</p>" : "") +
    (ind.descricao ? "<p>" + _esc(ind.descricao) + "</p>" : "") +
    "<p class=\"upd\">" + L.upd + " " + _esc(dataRef || "") + "</p>" +
    "<p><a href=\"/\">" + L.back + "</a></p>" +
    "</body></html>";
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
      return rw.transform(res);
    } catch (e) {
      return res; // nunca quebra: na dúvida, serve o original
    }
  }
};
