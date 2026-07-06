// Cloudflare Worker (static assets) — serve EN-static no domínio .com, inclusive p/ crawler SEM JS.
// Ambos domínios servem o MESMO index.html (PT estático). Só no .com raiz transformamos
// title/meta/OG/FAQ/lang para EN via HTMLRewriter (stream). DEFENSIVO: erro → serve o original.
// run_worker_first está escopado a "/" e "/index.html" → todo o resto serve estático (risco mínimo).

// Amostras semanais públicas (free) — datas que têm página estática /semanal/<data> (·/weekly no .com).
// Manual: o dono publica uma amostra vez ou outra p/ girar X/LinkedIn e gerar credibilidade. Para cada nova:
//   1) criar /semanal/<data>/index.html (+ /weekly/<data>/index.html EN); 2) adicionar "<data>" aqui.
// Na /diario/<data>, visitante FREE vê um link p/ a amostra — a da própria semana quando existir, senão a mais
// recente da lista (a estante fica sempre visível); ASSINANTE não (já recebe o semanal completo → sem duplicar).
const WEEKLY_SAMPLE_DATES = ["2026-06-26"];
const EN_TITLE = "Radar Perene — Brazil, observed and remembered";
const EN_DESC = "A living archive of Brazil's markets: daily, weekly and monthly reports and a library of precedents — to read the present in light of the past.";
const EN_KEYWORDS = "market regime, country risk, Brazil macro, interest rates, Selic, intermarket, FX, IFIX, REITs, IBOV, Brazilian Treasury, crypto, real estate liquidity, inflation, IPCA, study library, historical analogs, market regime analysis"; // ★ keywords PT vazavam no .com (worker não reescrevia) — espelha o EN_DESC/Dataset
const EN_FAQ = JSON.stringify({
  "@context": "https://schema.org", "@type": "FAQPage", "inLanguage": "en", "mainEntity": [
    { "@type": "Question", "name": "When does the weekly edition arrive?", "acceptedAnswer": { "@type": "Answer", "text": "The weekly edition arrives on Friday, after the market close (around 8:30pm BRT). The free daily reading goes out ~50 minutes before the open, with the prior day's close. The monthly closes on the last day of the month." } },
    { "@type": "Question", "name": "Are the weekly editions archived?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — as a subscriber, you receive the Friday editions from your subscription date onward. Perene Semanal is one edition per week; the monthly report library is part of institutional access." } },
    { "@type": "Question", "name": "How does Radar Perene compute Brazil's macro regime?", "acceptedAnswer": { "@type": "Answer", "text": "A monthly cross-market sensor outputs a Risk-BR score (0-100) from 8 domestic sub-scores (liquidity, defensive rotation, credit stress and more), calibrated on central-bank expectations (Focus since 2001) and real-rate curves (long NTN-B since 2006), isolating statistically-significant anomalies in 36-month windows." } },
    { "@type": "Question", "name": "How much does it cost and what's included?", "acceptedAnswer": { "@type": "Answer", "text": "Perene Semanal is US$ 29/mo (R$ 29 on .com.br) - the weekly Brazil edition, the archive, and access to each day's open edition. The daily regime reading is free. The full product (daily, library and per-asset observatory) is part of institutional access, by invitation to credentialed partners." } },
    { "@type": "Question", "name": "What is free at the Radar?", "acceptedAnswer": { "@type": "Answer", "text": "The daily regime reading is free: the regime, 5 lenses, the thesis, intermarket (3 pairs), fiscal, the BR analog summary (median and percent up), 3 Vertice thermometers, 1 divergence of the day and crypto (3 coins + Fear and Greed). The full statistical structure behind the reading — distributions, market breadth as a series, the full thermometers and analog studies, crypto on-chain and the deeper per-asset reading — is part of institutional access, by invitation to credentialed partners. In one line: free = understand where we are." } },
    { "@type": "Question", "name": "How do payment and the 7-day window work?", "acceptedAnswer": { "@type": "Answer", "text": "Payment is taken at signup (R$ on .com.br, US$ on .com), processed by Stripe. You have a 7-day full, automatic refund window, a legal right. After 7 days the normal recurrence continues. Cancel anytime in the portal, no human desk." } },
    { "@type": "Question", "name": "How do support, cancellation and data deletion work?", "acceptedAnswer": { "@type": "Answer", "text": "All subscription management, cancellation, refunds, card changes and invoices, is 100% self-service via the Stripe Customer Portal, in one click. Account and data deletion is also one click in your profile; we store nothing beyond your Google/Apple login and email." } },
    { "@type": "Question", "name": "Is this investment advice?", "acceptedAnswer": { "@type": "Answer", "text": "No. Under our P7 protocol the system is strictly descriptive: it reads regimes and anomalies from public sources and never recommends, predicts a price, or gives financial advice." } },
    { "@type": "Question", "name": "Does Radar Perene make forecasts?", "acceptedAnswer": { "@type": "Answer", "text": "No. Radar Perene does not predict a price or a point. It works with precedents, historical distributions and probabilities, describing what tended to follow similar environments, with the uncertainty band on display." } },
    { "@type": "Question", "name": "How do the studies work?", "acceptedAnswer": { "@type": "Answer", "text": "Each Study Library object answers one question: what historically happened next when a given environment occurred? Risk-on/off extreme, extreme pessimism/optimism, strong/weak dollar, Selic hiking/cutting cycle. The answer is the IBOV empirical distribution over 3/6/12 months (median, percent up, 50% and 80% bands)." } },
    { "@type": "Question", "name": "Does the Radar learn?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, through memory, self-evaluation and historical accumulation, not by rewriting the past. Past readings are confronted with the actual outcome 3/6/12 months later." } },
    { "@type": "Question", "name": "What are historical analogs?", "acceptedAnswer": { "@type": "Answer", "text": "Past episodes historically similar to today's environment. Not a forecast, but a distribution map: what happened next, with sample size and uncertainty shown." } },
    { "@type": "Question", "name": "What is the Study Library?", "acceptedAnswer": { "@type": "Answer", "text": "A collection of editorial objects built from conditional events: regimes, sentiment, liquidity and rates. Each is a citable study." } }
  ]
});

// ── SSR-EN do BODY da home (.com) p/ crawler SEM JS ────────────────────────────────
// O index.html é PT estático; o JS (catálogo C, branch EN) reescreve em-browser. O crawler
// sem-JS via PT. Aqui replicamos a MESMA branch EN p/ injetar via HTMLRewriter no .com.
// FONTE DA VERDADE: index.html linhas ~367-467 (branch EN do catálogo C + builders).
// Se aquele catálogo mudar, ESTE bloco precisa acompanhar (sem framework SSR no projeto).
const EN_BODY = (function () {
  const C = {
    h1: 'Brazil, observed — and <span class="g">remembered</span>.',
    lead: "A living archive of Brazil&rsquo;s markets: daily, weekly and monthly reports and a library of precedents to read the present in light of the past.",
    cta1: "Get the Friday edition →", cta2: "Read today&rsquo;s edition →", micro: "Educational content from public sources — never a recommendation.",
    eyb7: "Who it&rsquo;s for", s7: "Investors, analysts, managers — and serious newcomers.", s7s: "For anyone who wants to read Brazil&rsquo;s market without noise or guesswork — not the forecast, but the precedent: regimes, historical analogs and a study library of &ldquo;what happened next&rdquo;. Memory since 2000.",
    eyb2: "Methodology", s2: "How the Radar reads Brazil", s2s: "Under the reading, the system combines the country&rsquo;s regulatory domains and a cross-asset experiment — the engine, not the stage. <a href=\"/methodology/\">See the methodology →</a>",
    eyb6: "What&rsquo;s underneath",
    eybTz: "Live · now", sTz: "Today&rsquo;s reading", sTzS: "Brazil&rsquo;s regime right now. Institutional access adds the numbers, the full analogs and 50+ years of history.", tzMore: "See the full radar ↓",
    eyb1: "Live · full radar", s1: "The full radar", s1s: "The complete engine over today&rsquo;s public data. History, scenarios and free cross-analysis are in the paid plan.",
    fdisc: "",
    eyb3: "For your site · free", s3: "Use our mini-radar anywhere", s3s: "A free public endpoint with today&rsquo;s reading (JSON). Embed it, cite the source. Great for portals, newsletters and communities.",
    eyb4: "Principles",
    disc: "Educational and informational content from public sources. Descriptive — NOT investment advice, an offer, solicitation or financial counsel.",
    ftnav: '<span class="ftcol"><b>Reading</b> <a href="/daily">Daily</a> · <a href="/articles">Articles</a></span><span class="ftcol"><b>The Radar</b> <a href="/how-to-read-the-radar/">How to read</a> · <a href="/methodology/">How we read Brazil</a> · <a href="/concepts/">Concepts</a></span><span class="ftcol"><b>For institutions</b> <a href="/founder/">Institutional access</a> · <a href="/lenses/">Lenses</a> · <a href="/widgets/">Embeddable widget</a></span><span class="ftcol"><b>House &amp; legal</b> <a href="/about">About</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a> · <a href="/masthead/">Masthead</a></span>',
    lenses: [{ n: "Wealth", d: "Succession, estate tax, holdings." },
      { n: "Electoral", d: "Electoral courts, eligibility, finance." },
      { n: "Macro / Rates", d: "Rates, inflation, fiscal, debt." },
      { n: "Institutional", d: "Laws, taxes and rulings in the making." },
      { n: "Real estate", d: "REITs, real-estate credit, regulation." },
      { n: "Vértice", d: "Cross-asset thermometers, breadth, analogs — hypothesis, not a forecast.", v: 1 }],
    princ: [["Descriptive", "We read and contextualize the regime — we never recommend or predict a price."],
      ["Public sources", "Built on public data. Low-noise, auditable, transparent."],
      ["Contradiction on show", "Every reading carries its own counter-evidence. No false certainty."]],
    eyb9: "FAQ", s9: "How it works",
    faq: [["When does the weekly edition arrive?", "The weekly edition arrives on Friday, after the market close (around 8:30pm BRT). The free daily reading goes out ~50 minutes before the open, with the prior day&rsquo;s close. The monthly closes on the last day of the month."], ["Are the weekly editions archived?", "Yes — as a subscriber, you receive the Friday editions from your subscription date onward. Perene Semanal is one edition per week; the monthly report library is part of institutional access."], ["How does Radar Perene compute Brazil&rsquo;s macro regime?", "The Radar condenses the Brazilian market into proprietary indices — the Perene Risk Index, ANIMA and the regime reading — built on public data since 2000, with a declared, stable method. The detail lives in the Methodology."], ["How much does it cost and what's included?", "Perene Semanal is US$ 29/mo (R$ 29 on .com.br) — the weekly Brazil edition, the archive, and access to each day&rsquo;s open edition. The daily regime reading is free. The full product (daily, library and per-asset observatory) is part of institutional access, by invitation to credentialed partners."], ["How do payment and the 7-day window work?", "Payment is taken at signup (R$ on the .com.br domain, US$ on .com), processed by Stripe. You have a 7-day full, automatic refund window — a legal right, no friction. After 7 days the normal recurrence (monthly or annual) continues. Everything is managed by you in the Stripe Customer Portal."], ["How do support, cancellation and data deletion work?", "Your subscription is managed by you in the Stripe Customer Portal — cancellation, refunds, card changes and invoices in one click, anytime. Account and data deletion is also one click in your profile — we store nothing beyond your login and email."], ["Is this investment advice?", "No. Under our P7 protocol the system is strictly descriptive — it reads regimes and anomalies from public sources and never recommends, predicts a price, or gives financial advice."], ["Does Radar Perene make forecasts?", "No. Radar Perene does not predict a price or a point. It works with precedents, historical distributions and probabilities — describing what tended to follow similar environments, with the uncertainty band on display."], ["How do the studies work?", "Each Library study answers one question: what historically happened next when ___? — risk-on/off extreme, extreme pessimism/optimism, strong/weak dollar, Selic hiking/cutting cycle. The answer is the IBOV&rsquo;s empirical distribution over 3/6/12 months (median, % up, and the 50% and 80% bands)."], ["Does the Radar learn?", "Yes — through memory, self-evaluation and historical accumulation, not by rewriting the past. Past readings are confronted with the actual outcome 3/6/12 months later."], ["What are historical analogs?", "Past episodes historically similar to today&rsquo;s environment. Not a forecast — a distribution map: what happened next, with sample size and uncertainty shown."], ["What is the Study Library?", "A collection of editorial objects built from conditional events — regimes, sentiment, liquidity and rates. Each is a citable study: the Radar has a study for that."]]
  };
  const LSLUG = ["patrimonial", "eleitoral", "macro", "institucional", "imobiliaria", "vertice"];
  const ELEN = { patrimonial: "wealth", eleitoral: "electoral", institucional: "institutional", imobiliaria: "real-estate" };
  const ECON = { "regime-brasil": "regime-brazil", "intermercado-br": "intermarket-br", "indice-anima": "anima-index", "analogos-historicos": "historical-analogs" };
  const U_MET = "/methodology/", U_CON = "/concepts/", U_LEN = "/lenses/", U_HOW = "/how-to-read-the-radar/";
  const LP = (s) => U_LEN + (ELEN[s] || s) + "/";
  const CP = (s) => U_CON + (ECON[s] || s) + "/";
  const expTag = "experiment";
  const NAV = { met: "Methodology", con: "Concepts", len: "Lenses", dia: "Daily", howto: "How to read", free: "Free", ac: "All concepts →", al: "All lenses →" };
  const CN = [["regime-brasil", "Brazil Regime"], ["regime-global", "Global Regime"], ["intermercado-br", "Intermarket BR"], ["indice-anima", "Ânima Index"], ["risk-on-risk-off", "Perene Risk Index"], ["analogos-historicos", "Historical Analogs"], ["vertice", "Vértice"]];
  const CD = ["Brazil's prevailing market state", "the external environment pressing on Brazil", "cross-reading of Brazilian wealth-sector ratios", "reading of Brazilian market mood", "Brazil's risk-appetite gauge (0–100), stacked with Ânima", "past windows with a similar profile", "hypotheses where distant markets cross"];
  const lenses = C.lenses.map((l, i) => '<a class="ln' + (l.v ? ' vx' : '') + '" href="' + LP(LSLUG[i]) + '"><div class="nm">' + (l.v ? '<span style="color:var(--gold-ink)">✦</span> ' : '') + l.n + (l.v ? '<span class="tag">' + expTag + '</span>' : '') + '</div><p>' + l.d + '</p>' + (l.m ? '<span class="micro">' + l.m + '</span>' : '') + '</a>').join("");
  const conDD = CN.map((c) => '<a href="' + CP(c[0]) + '">' + c[1] + '</a>').join("") + '<a href="' + U_CON + '" style="color:var(--gold-ink)">' + NAV.ac + '</a>';
  const lenDD = C.lenses.map((l, i) => '<a href="' + LP(LSLUG[i]) + '">' + l.n + '</a>').join("") + '<a href="' + U_LEN + '" style="color:var(--gold-ink)">' + NAV.al + '</a>';
  const topnav = '<a href="/articles">Articles</a><a href="' + U_CON + '">' + NAV.con + '</a><a href="/daily">' + NAV.dia + '</a>';
  const cgrid = CN.map((c, i) => '<a href="' + CP(c[0]) + '"><span class="cn">' + c[1] + '</span><span class="cd">' + CD[i] + '</span></a>').join("");
  const princ = C.princ.map((p) => '<div><b>' + p[0] + '.</b> ' + p[1] + '</div>').join("");
  const faqbox = C.faq.map((f) => '<div style="border-top:1px solid #222a31;padding:13px 0"><b style="display:block;margin-bottom:5px">' + f[0] + '</b><p style="margin:0;color:#8b97a3;font-size:14px;line-height:1.6">' + f[1] + '</p></div>').join("");
  return {
    "h1": C.h1, "lead": C.lead, "cta1": C.cta1, "cta2": C.cta2, "micro1": C.micro,
    "eyb7": C.eyb7, "s7": C.s7, "s7s": C.s7s, "eyb2": C.eyb2, "s2": C.s2, "s2s": C.s2s,
    "eyb-lng": "The Radar's language", "s-lng": "The concepts behind the reading", "s-lng-s": "Regime, lenses, intermarket, percentile, analog, hypothesis. Those who understand this language read the product — each term has its own page.", "lng-cta": "See the full Radar language →",
    "eyb6": C.eyb6,
    "eyb-tz": C.eybTz, "s-tz": C.sTz, "s-tz-s": C.sTzS, "tz-more": C.tzMore,
    "eyb1": C.eyb1, "s1": C.s1, "s1s": C.s1s,
    "eyb-ult": "Latest readings", "s-ult": "The regime diary", "s-ult-s": "The Radar publishes the day's regime daily. Each entry is brief, dated and verifiable — set within a historical series built over time.", "ult-cta": "See the full Diaries →",
    "eyb3": C.eyb3, "s3": C.s3, "s3s": C.s3s, "eyb4": C.eyb4, "disc": C.disc,
    "eyb9": C.eyb9, "s9": C.s9, "qtag-txt": "CURRENT SIGNAL · REGIME BR",
    // ★ a11y 2026-06-27: ids que serviam PT estático no .com (flash + dependência de JS) → traduzidos server-side.
    //   Valores idênticos ao set() EN do index.html (blocos Founder-home, Semanal, "Do arquivo", CTA profundo).
    "fnd-lead": "The mechanisms behind the readings.", "fnd-s": "To see what underpins the readings: the precedents, the historical analogs and the Radar&rsquo;s experimental observatory.", "fnd-cta": "Institutional access →",
    "sem-eyb": "Subscription", "sem-h": "Perene Semanal", "sem-s": "Every Friday, an edition of what changed, what held, and what the archive remembers.", "sem-cta": "Get the Friday edition →",
    "s-arq": "The present, in conversation with memory", "s-arq-s": "What the Radar recorded — and what came next.",
    "prof-h": "One publication, four depths", "prof-p": 'The <b>Daily</b> is the cover: each day&rsquo;s regime reading, open to all, since 2000. <b><a href="/subscribe" style="color:inherit">Perene Semanal</a></b> (US$ 29/mo) is the Friday edition — what changed, what held, what the archive remembers — with its own archive. The <b>Monthly</b> and the library since 2010 are part of <a href="/founder/" style="color:inherit">institutional access</a>, together with the full observatory — granted in conversation, to credentialed partners. The <b>Vértice</b> letter circulates as a pilot, to a small group of readers.', "prof-links": '<a href="/" style="color:var(--gold-ink)">Read today&rsquo;s open edition →</a> · <a href="/subscribe" style="color:var(--gold-ink)">Get the Friday edition →</a> · <a href="/founder/" style="color:var(--gold-ink)">Institutional access →</a>',
    "lenses": lenses, "topnav": topnav, "conceitos-grid": cgrid, "princ": princ, "faqbox": faqbox, "ftnav": C.ftnav
  };
})();

// JSON-LD @graph (Organization/WebSite/Dataset/Service) em EN p/ o .com (o JS NÃO traduz este graph).
const EN_GRAPH = JSON.stringify({
  "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": "https://radarperene.com/#org", "name": "Radar Perene", "alternateName": "Método Perene", "url": "https://radarperene.com", "email": "hello@radarperene.com", "logo": "https://radarperene.com/avatar-square-800.png", "image": "https://radarperene.com/og-image-1200x630.png", "description": "An editorial publication that reads Brazil's market regime and what tended to follow similar episodes — macro, intermarket and context, from public sources. It describes the present in light of precedent, with a library of episodes (\"what happened next when…\") since 2000. It does not forecast prices and is not investment advice.", "knowsLanguage": ["en", "pt-BR"], "areaServed": { "@type": "Country", "name": "Brazil" }, "sameAs": ["https://radarperene.com.br"], "founder": { "@id": "https://brazilcomplexity.com/about.html#person" } },
    { "@type": "WebSite", "@id": "https://radarperene.com/#website", "url": "https://radarperene.com", "name": "Radar Perene", "publisher": { "@id": "https://radarperene.com/#org" }, "inLanguage": ["en", "pt-BR"], "potentialAction": { "@type": "SearchAction", "target": { "@type": "EntryPoint", "urlTemplate": "https://radarperene.com/?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
    { "@type": "Dataset", "@id": "https://radarperene.com/#dataset", "name": "Radar Perene — Brazil market regime, macro and intermarket", "description": "Descriptive series and scores of the market regime, rates/Selic, country risk, intermarket, FX, REITs (IFIX), Treasury, crypto, real estate (ILI · Real Estate Liquidity Index) and inflation (IPCA/IGP-M/INCC/SINAPI), plus regulatory/judicial activity. Public data since 2000, continuously updated. Descriptive, never a recommendation or price forecast.", "url": "https://radarperene.com/", "creator": { "@id": "https://radarperene.com/#org" }, "isAccessibleForFree": true, "license": "https://radarperene.com/", "inLanguage": ["en", "pt-BR"], "spatialCoverage": { "@type": "Place", "name": "Brazil" }, "temporalCoverage": "2000-01-01/..", "keywords": ["market regime", "country risk", "Brazil macro", "interest rates", "Selic", "intermarket", "FX", "IFIX", "REITs", "IBOV", "Brazilian Treasury", "real estate liquidity", "ILI", "inflation", "IPCA", "study library", "historical analogs", "asset comparisons", "self-evaluation", "historical distributions", "market precedents", "conditional events", "what happened next"], "variableMeasured": ["regime_br_score", "risk_global_score", "intermarket", "analog-case distribution (3/6/12m)", "median and p10-p90 bands"], "distribution": { "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "https://radarperene.com/INTEGRACAO_RADAR.md" } },
    { "@type": "Service", "@id": "https://radarperene.com/#service", "name": "Radar Perene — Perene Semanal", "serviceType": "Editorial publication on the Brazilian market regime", "provider": { "@id": "https://radarperene.com/#org" }, "areaServed": { "@type": "Country", "name": "Brazil" }, "description": "Perene Semanal: the Friday edition (after the market close) of what changed, what held, and what the archive remembers — plus the archive of editions and access to each day's open edition. Descriptive, never a recommendation.", "offers": { "@type": "Offer", "price": "29", "priceCurrency": "USD", "url": "https://radarperene.com/subscribe" }, "hasOfferCatalog": { "@type": "OfferCatalog", "name": "Cadence", "itemListElement": [{ "@type": "OfferCatalog", "name": "Weekly (Friday) + archive + daily open edition" }] } }
  ]
});

// freshness do Dataset do @graph (auditoria SEO 2026-06-11): fecha o temporalCoverage na data da leitura e
// adiciona dateModified — funciona por SPLICE na string serializada (EN_GRAPH e o graph PT estático do index.html
// têm a MESMA âncora "2000-01-01/.."). Sem data → graph original, intacto.
function _graphDated(g, dt) { return dt ? g.replace('"temporalCoverage":"2000-01-01/.."', '"temporalCoverage":"2000-01-01/' + dt + '","dateModified":"' + dt + '"') : g; }

const NARR_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjanRrZ2x0cnhkbmxhY2V6cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTk3MDQsImV4cCI6MjA5NTc5NTcwNH0.CkEmnGCSTfF-9FjjebyeBUFV0-vW6CsfpyBea6cLCUs";
const NARR_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/narrative";
const IND_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/indicadores";
const SNAP_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/snapshot";
const SNAPS_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/snapshots";
const HIST_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/historico";  // track record (leituras maturadas vs desfecho)
const LDD_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/leitura-do-dia";
const COB_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/cobertura";

// ── cobertura VIVA: 1 fetch cacheado (1h) → preenche spans [data-cob] em QUALQUER página HTML ──
// "engrenagem só": adicionou dado no banco → a fn SQL cobertura_radar muda → o número novo flui pro site
// sozinho, sem rebuild. DEFENSIVO: API fora → mantém o fallback honesto já escrito no HTML.
// ── resiliência upstream (Supabase): timeout (AbortController) + single-flight + stale-on-error. NÃO é circuit
//    breaker — só evita (a) request pendurado, (b) thundering herd no cache frio, (c) tela vazia num soluço do
//    upstream. _UPSTREAM_TIMEOUT_MS > o cold do /digest (~4,3s): corta só o que está REALMENTE pendurado.
const _UPSTREAM_TIMEOUT_MS = 9000;
async function _fetchT(url, opts, ms) {
  const ctl = new AbortController();
  const to = setTimeout(function () { ctl.abort(); }, ms || _UPSTREAM_TIMEOUT_MS);
  try { return await fetch(url, Object.assign({}, opts || {}, { signal: ctl.signal })); }
  finally { clearTimeout(to); }
}
const _inflight = new Map();  // single-flight por chave (colapsa fetches concorrentes no mesmo isolate)
let _cobLast = null;          // último cobertura bom → stale-on-error
let _tickersLast = null;      // última lista de tickers boa → /ativos sobrevive a soluço do DB (nunca 404)
async function _fetchCobertura() {
  try {
    const r = await _fetchT(COB_API, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } });
    if (r.ok) { const j = await r.json(); _cobLast = j; return j; }
    return _cobLast;  // upstream !ok → última boa (badge de cobertura não some)
  } catch (e) { return _cobLast; }  // timeout/erro → stale
}
// ── Cache na borda do WORKER via Cache API (caches.default). ⚠️ cf:{cacheTtl,cacheEverything} NÃO cacheia os
//    subrequests ao supabase.co: a resposta carrega Set-Cookie (__cf_bm, do Bot Management da CF na frente do
//    Supabase) e a Cloudflare RECUSA cachear qualquer resposta com Set-Cookie. Workaround: guardamos uma cópia
//    LIMPA (corpo + content-type, sem Set-Cookie) numa chave sintética → vira HIT nas próximas invocações do
//    worker no mesmo colo. DEFENSIVO: qualquer falha → null (a home/página degrada pro caminho sem o dado).
async function _cachedText(url, key, ttl) {
  try {
    const cache = caches.default;
    const ck = new Request("https://rp-cache.internal/" + key);
    const sk = new Request("https://rp-cache.internal/stale/" + key);  // cópia stale (24h) p/ stale-on-error
    const hit = await cache.match(ck);
    if (hit) return await hit.text();
    if (_inflight.has(key)) return await _inflight.get(key);  // single-flight: 1 fetch por chave concorrente no isolate
    const p = (async function () {
      try {
        const fresh = await _fetchT(url, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON } });
        if (!fresh.ok) throw new Error("upstream " + fresh.status);
        const body = await fresh.text();
        await cache.put(ck, new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=" + ttl } }));   // fresco (TTL)
        await cache.put(sk, new Response(body, { headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" } }));     // stale (24h)
        return body;
      } catch (e) {
        const stale = await cache.match(sk);  // stale-on-error: soluço/timeout do upstream → serve a última boa
        return stale ? await stale.text() : null;
      }
    })();
    _inflight.set(key, p);
    try { return await p; } finally { _inflight.delete(key); }
  } catch (e) { return null; }
}
async function _cachedJson(url, key, ttl) { const t = await _cachedText(url, key, ttl); if (t == null) return null; try { return JSON.parse(t); } catch (e) { return null; } }
// ── PROXY /api/* → Supabase functions, sob o MESMO domínio. Forward de Authorization+apikey do cliente → o
//    token-gating do moat (premiumFromReq valida o JWT real) sobrevive intacto. GET ANON → _cachedText (single-flight
//    + stale-on-error + cópia limpa sem Set-Cookie); Founder (Bearer≠anon) e POST → pass-through SEM cache (jamais
//    grava resposta premium na chave anon → casa com o Vary:Authorization do edge, moat preservado). Anti-SSRF: host
//    fixo + só radar-api/v1/* | estudos | waitlist alcançáveis (regex sem '.' → sem traversal); query sanitizada no edge.
const _API_CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-max-age": "86400" };
function _apiUpstream(sub, search) {
  const u = sub.toLowerCase().indexOf("v1/") === 0 ? "/radar-api/" + sub : "/" + sub;
  return "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1" + u + (search || "");
}
async function _proxyApi(request, _url, sub) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: _API_CORS });
  // ★ EXCLUSIVIDADE POR DOMÍNIO/MOEDA: injeta cur pelo host nos endpoints GATEADOS (me/serie/biblioteca),
  //   que são autenticados (pass-through, sem cache anon → não fragmenta). USD→.com, BRL→.com.br. O edge
  //   filtra a assinatura Stripe pela moeda → assinante USD só destrava o .com; BRL só o .com.br.
  let _search = _url.search;
  // ★ 2026-07-01: default de idioma por DOMÍNIO no contrato público — .com => EN, .com.br => PT (a menos de ?lang explícito).
  //   Antes o edge assumia pt sempre → embeds/consumidores diretos do .com recebiam PT. Chave de cache usa _search (com lang) → sem poluição cross-idioma.
  if (!/\.com\.br$/i.test(_url.hostname) && !/[?&]lang=/i.test(_search)) _search = (_search ? _search + "&" : "?") + "lang=en";
  const _sl = sub.toLowerCase();
  if (_sl === "v1/me" || _sl.indexOf("v1/serie") === 0 || _sl.indexOf("v1/biblioteca") === 0) {
    const _cur = /\.com\.br$/i.test(_url.hostname) ? "brl" : "usd";
    _search = (_search ? _search + "&" : "?") + "cur=" + _cur;
  }
  const upstream = _apiUpstream(sub, _search);
  const auth = request.headers.get("Authorization") || "";
  const apikey = request.headers.get("apikey") || NARR_ANON;
  const isAnon = !auth || auth === "Bearer " + NARR_ANON;
  try {
    // GET anon = a esmagadora maioria do tráfego (free + embed) → cacheável na borda. Chave = sub+query ENCODADA (sem ? & = soltos).
    if (request.method === "GET" && isAnon) {
      const body = await _cachedText(upstream, "api-" + encodeURIComponent(sub + _search), 900);
      if (body != null) return new Response(body, { status: 200, headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=900", "x-rp-proxy": "anon" }, _API_CORS) });
      // _cachedText null = upstream NÃO-200 (ex.: 404 estudo inexistente / 400 param ruim) OU down sem stale. NÃO mascarar
      //   como 503: repassa o status+corpo REAIS (sem cachear) → o cliente vê o mesmo que veria batendo o edge direto.
      const fb = await _fetchT(upstream, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON } });
      const fbody = await fb.text();
      return new Response(fbody, { status: fb.status, headers: Object.assign({ "content-type": fb.headers.get("content-type") || "application/json; charset=utf-8", "x-rp-proxy": "anon-passthru" }, _API_CORS) });
    }
    // Founder (GET c/ token real) ou POST (waitlist) → pass-through, forward do Authorization do cliente, SEM cache.
    const init = { method: request.method, headers: { apikey: apikey, Authorization: auth || ("Bearer " + NARR_ANON) } };
    if (request.method !== "GET" && request.method !== "HEAD") { init.body = await request.text(); init.headers["content-type"] = request.headers.get("content-type") || "application/json"; }
    const r = await _fetchT(upstream, init);
    const txt = await r.text();
    return new Response(txt, { status: r.status, headers: Object.assign({ "content-type": r.headers.get("content-type") || "application/json; charset=utf-8", "x-rp-proxy": isAnon ? "anon-nocache" : "founder" }, _API_CORS) });
  } catch (e) { return new Response('{"erro":"indisponivel"}', { status: 503, headers: Object.assign({ "content-type": "application/json" }, _API_CORS) }); }
}
function _humLinhas(n, en) {
  if (n == null || !isFinite(n)) return null;
  if (n >= 1e6) { const m = Math.round(n / 1e5) / 10; return en ? (m + "M") : (String(m).replace(".", ",") + " mi"); }
  if (n >= 1e3) return Math.round(n / 1e3) + (en ? "K" : " mil");
  return String(n);
}
// ── Consentimento LGPD (opt-in): GA4 consent-gated (usa cookies) + Ahrefs Web Analytics SEMPRE
//    (cookieless/sem-PII → LGPD-ok; gateá-lo impedia o Ahrefs de "conectar": o verificador não aceita
//    cookies → script nunca disparava). chave POR DOMÍNIO via
//    location.hostname (.com=EN, .com.br=PT). Injetado pelo worker em TODA página (estática, diário,
//    /ativo, futuras) → cobertura universal automática. A home (index.html) tem o seu próprio (idêntico).
const _CONSENT = '<div id="rp-cookie" style="display:none;position:fixed;left:0;right:0;bottom:0;z-index:9999;background:var(--bg,#faf9f6);border-top:1px solid var(--line,#e6e3dc);padding:14px 18px;font:13px/1.5 \'Inter\',system-ui,sans-serif;color:var(--txt,#1a1a2e)"><div style="max-width:1080px;margin:0 auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center"><span id="rp-ck-txt" style="flex:1;min-width:240px;color:var(--dim,#6e6e78)">Usamos cookies de medição (analytics) para melhorar o site. Você escolhe — sem isso, nada é rastreado.</span><button id="rp-ck-no" style="background:none;border:0;color:var(--dim,#6e6e78);font:600 13px/1 inherit;cursor:pointer;text-decoration:underline;padding:6px 4px">Recusar</button><button id="rp-ck-yes" style="background:none;border:0;color:var(--gold-ink,#94560f);font:700 13px/1 inherit;cursor:pointer;text-decoration:underline;padding:6px 4px">Aceitar</button></div></div>' +
  '<script>(function(){var EN=/radarperene\\.com$/i.test(location.hostname)&&!/\\.com\\.br$/i.test(location.hostname);if(EN){var t=document.getElementById("rp-ck-txt");if(t)t.textContent="We use measurement (analytics) cookies to improve the site. Your choice — nothing is tracked without it.";document.getElementById("rp-ck-no").textContent="Decline";document.getElementById("rp-ck-yes").textContent="Accept";}var KEY="rp-consent";window.rpTrack=function(name){if(localStorage.getItem(KEY)!=="granted")return;try{if(window.gtag)gtag("event",name);}catch(e){}};function loadAhrefs(){var AH=/\\.com\\.br$/i.test(location.hostname)?"4LbsuoMGfXN4azVzHW6wPQ":"m9HGU5S9vnFEBS9K4J62rg";var sa=document.createElement("script");sa.async=1;sa.src="https://analytics.ahrefs.com/analytics.js";sa.setAttribute("data-key",AH);document.head.appendChild(sa);}loadAhrefs();function loadAnalytics(){var GA=/\\.com\\.br$/i.test(location.hostname)?"G-4LVGNLRV9L":"G-CWB77T178R";var s=document.createElement("script");s.async=1;s.src="https://www.googletagmanager.com/gtag/js?id="+GA;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag("js",new Date());gtag("config",GA);}var c=localStorage.getItem(KEY),bar=document.getElementById("rp-cookie");if(c==="granted"){loadAnalytics();}else if(c!=="denied"){bar.style.display="block";}document.getElementById("rp-ck-yes").onclick=function(){localStorage.setItem(KEY,"granted");bar.style.display="none";loadAnalytics();};document.getElementById("rp-ck-no").onclick=function(){localStorage.setItem(KEY,"denied");bar.style.display="none";};})();<\/script>';
function _consentRw(rw) { return rw.on("body", { element(e) { e.append(_CONSENT, { html: true }); } }); }
// ── slug i18n do arquivo diário NO .com (EN): reescreve qualquer link /diario… → /daily… ANTES de servir, em vez de
//    deixar o 301 /diario→/daily atuar no clique. O Ahrefs marca "Page has links to redirect" quando uma página
//    LINKA p/ uma URL que redireciona — então o link tem de já apontar p/ o destino final. SEMPRE gated por isEN no
//    chamador (no .com.br /diario é 200, não se toca). /daily não redireciona → sem loop. HTMLRewriter = streaming, custo ~0.
function _enDailyRw(rw) { return rw.on('a[href^="/diario"]', { element(e) { const h = e.getAttribute("href"); if (h) e.setAttribute("href", h.replace(/^\/diario/, "/daily")); } }); }
// slug i18n da BIBLIOTECA no .com (EN): /biblioteca… → /library… (mesmo motivo do _enDailyRw — evita slug PT + 301 no clique).
function _enLibraryRw(rw) { return rw.on('a[href^="/biblioteca"]', { element(e) { const h = e.getAttribute("href"); if (h) e.setAttribute("href", h.replace(/^\/biblioteca/, "/library")); } }); }

function _cobRewriter(rw, cob, en) {
  if (!cob) return rw;
  const map = {
    ativos: cob.ativos != null ? String(cob.ativos) : null,
    linhas: _humLinhas(cob.linhas, en),
    tribunais: cob.tribunais != null ? String(cob.tribunais) : null,
    desde: cob.desde != null ? String(cob.desde) : null,
  };
  for (const k in map) {
    if (map[k] == null) continue;
    const val = map[k];
    rw = rw.on('span[data-cob="' + k + '"]', { element(e) { e.setInnerContent(val); } });
  }
  return rw;
}

// escape p/ texto em HTML (defensivo: catálogo é a única fonte, mas nunca confiamos cego)
function _esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// meta description ≤ n (corta em palavra inteira) — evita "meta description too long" do Ahrefs
function _clampDesc(s, n) { s = String(s == null ? "" : s); if (s.length <= n) return s; return s.slice(0, n).replace(/\s+\S*$/, "").replace(/[\s,.;:—–-]+$/, ""); }
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
// ── chrome compartilhado das páginas worker-rendered → casa com a identidade do site (Newsreader/Inter, paleta creme/dourado, tema claro/escuro) ──
function _chromeCss(extra) {
  return '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">' +
    '<style>:root{--bg:#faf9f6;--surface:#fff;--surface2:#f3f1ec;--line:#e6e3dc;--txt:#1a1a2e;--txt2:#3a3a45;--dim:#5f5f69;--gold:#a8651a;--gold-ink:#94560f;--btn-ink:#fff;--serif:\'Newsreader\',Georgia,serif;--sans:\'Inter\',system-ui,sans-serif;--mono:\'JetBrains Mono\',ui-monospace,monospace;--max:760px}' +
    ':root[data-theme="dark"]{--bg:#0e1217;--surface:#161b22;--surface2:#1c222b;--line:#28303a;--txt:#eceef1;--txt2:#c2c8d0;--dim:#8a929e;--gold:#d9a441;--gold-ink:#d9a441;--btn-ink:#0a0c0f}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:var(--sans);line-height:1.6;-webkit-font-smoothing:antialiased;transition:background .2s,color .2s}' +
    '.skip{position:absolute;left:8px;top:-48px;z-index:200;background:var(--gold);color:var(--btn-ink);padding:9px 16px;border-radius:2px;font-weight:600;font-size:14px;text-decoration:none}.skip:focus{top:8px;outline:2px solid var(--txt);outline-offset:2px}' +
    '.top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 22px;max-width:var(--max);margin:0 auto}' +
    '.brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--txt)}.brand .nm{font-family:var(--serif);font-size:17px;font-weight:600}.brand .nm b{color:var(--gold-ink)}.brand .logo-w{display:block;height:35px;width:auto}:root[data-theme="dark"] .logo-w-light{display:none}:root:not([data-theme="dark"]) .logo-w-dark{display:none}' +
    '.tg{background:none;border:1px solid var(--line);color:var(--dim);border-radius:7px;width:30px;height:30px;cursor:pointer;font-size:13px}' +
    '.wrap{max-width:var(--max);margin:0 auto;padding:6px 22px 30px}' +
    'h1{font-family:var(--serif);font-weight:500;font-size:clamp(23px,4vw,33px);line-height:1.16;letter-spacing:-.01em;margin:14px 0 4px}' +
    'h2{font-family:var(--serif);font-weight:500;font-size:19px;margin:24px 0 6px}' +
    'a{color:var(--gold-ink)}p{color:var(--txt2)}ul{padding-left:1.1rem}li{margin:.35rem 0;color:var(--txt2)}' +
    '.dt{color:var(--dim);font-size:.85rem;margin-bottom:1rem}.nf{color:var(--dim);font-size:.8rem;margin-top:.6rem}' +
    'pre.api{background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:11px 13px;overflow:auto;font-size:12px;font-family:var(--mono);color:var(--txt2)}' +
    'footer{max-width:var(--max);margin:0 auto;padding:20px 22px;border-top:1px solid var(--line);color:var(--dim);font-size:12px}footer a{color:var(--gold-ink)}' +
    (extra || "") + '</style>';
}
function _header(en) {
  return '<a class="skip" href="#main">' + (en ? "Skip to content" : "Pular para o conteúdo") + '</a>' +
    '<header class="top"><a class="brand" href="/"><img class="logo-w logo-w-light" src="/logo-light.svg" alt="Radar Perene" width="139" height="35"><img class="logo-w logo-w-dark" src="/logo-dark.svg" alt="Radar Perene" width="139" height="35"></a><button class="tg" id="rp-tg" type="button" aria-label="tema">☾</button></header>' +
    '<main id="main">';
}
function _themeScript() {
  return '<script>(function(){try{var t=localStorage.getItem("rp-theme");if(t!=="light"&&t!=="dark")t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}var b=document.getElementById("rp-tg");if(b){b.setAttribute("aria-pressed",document.documentElement.getAttribute("data-theme")==="dark"?"true":"false");b.onclick=function(){var c=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",c);try{localStorage.setItem("rp-theme",c);}catch(e){}b.setAttribute("aria-pressed",c==="dark"?"true":"false");};}})();</script>';
}
function _renderIndicador(ind, dataRef, origin, lang, slug) {
  const en = lang === "en";
  const nome = _esc(ind.nome);
  const valorStr = _esc(_fmtVal(ind.valor, ind.unidade));
  const isPerc = /percentil|pctl/i.test(ind.unidade || "");  // unidade já é percentil → não repete "Percentil histórico"
  const temPerc = !isPerc && ind.percentil !== null && ind.percentil !== undefined && ind.percentil !== "";
  const canon = origin + "/indicador/" + encodeURIComponent(slug);
  const desc = _esc(_clampDesc(ind.descricao || ind.leitura || nome, 148));
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
    "dateModified": dataRef || undefined,  // freshness (auditoria SEO 2026-06-11): a leitura muda ~diariamente; sem dateModified o crawler não vê
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
    "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"icon\" href=\"/favicon.ico\" sizes=\"48x48\"><link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/favicon-32x32.png\"><link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/favicon-16x16.png\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-light.svg\" media=\"(prefers-color-scheme: light)\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-dark.svg\" media=\"(prefers-color-scheme: dark)\"><link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/apple-touch-icon.png\"><link rel=\"mask-icon\" href=\"/safari-pinned-tab.svg\" color=\"#131521\"><link rel=\"manifest\" href=\"/site.webmanifest\">" +
    "<title>" + _esc(title) + "</title>" +
    "<meta name=\"description\" content=\"" + desc + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<meta property=\"og:type\" content=\"website\">" +
    "<meta property=\"og:title\" content=\"" + _esc(title) + "\">" +
    "<meta property=\"og:description\" content=\"" + desc + "\">" +
    "<meta property=\"og:url\" content=\"" + canon + "\">" +
    "<meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ldStr + "</script>" +
    _chromeCss("h1{font-size:clamp(24px,4vw,32px)}b{color:var(--gold-ink)}p{margin:.5rem 0}.upd{color:var(--dim);font-size:.85rem;margin-top:1.4rem}") +
    "</head><body>" + _header(en) + "<div class=\"wrap\">" +
    "<h1>" + nome + "</h1>" +
    "<p>" + L.cur + " <b>" + valorStr + "</b></p>" +
    (temPerc ? "<p>" + L.perc + " <b>" + _esc(ind.percentil) + "</b></p>" : "") +
    (ind.classificacao ? "<p>" + L.cls + " " + _esc(ind.classificacao) + "</p>" : "") +
    (ind.leitura ? "<p>" + _esc(ind.leitura) + "</p>" : "") +
    (ind.descricao ? "<p>" + _esc(ind.descricao) + "</p>" : "") +
    "<p class=\"upd\">" + L.upd + " " + _esc(dataRef || "") + "</p>" +
    "</div></main><footer><a href=\"/\">" + L.back + "</a></footer>" + _themeScript() + _CONSENT + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

// ── ARQUIVO DIÁRIO (/diario) — páginas citáveis congeladas + verificação do desfecho ──
function _diarioFetch(url) {
  return _fetchT(url, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } });
}
// ── Bloco do ASSINANTE na página /diario/<data> (client-side): para Founder logado, busca
//    /v1/biblioteca/item?tipo=diario&data=<date> com o Bearer da sessão e revela a prosa abaixo
//    dos números (server-rendered). Anon/free → gancho + CTA. DEFENSIVO: try/catch — se o script
//    falhar, a página numérica (já no HTML) fica intacta. A página é edge-cacheada; o conteúdo
//    gateado vem por fetch per-user (não cacheado), casando com o Vary:Authorization do edge.
function _memoGate(date, sampleDate) {
  const J = JSON.stringify;
  // #rp-weekly: banner client-side p/ a amostra semanal FREE (/semanal/<data> ·/weekly no .com). Só aparece
  //   p/ visitante NÃO-assinante (assinante recebe o semanal completo → não duplica). Default oculto; revelado
  //   por JS conforme o status da sessão (mesma detecção do memo: corpo_md no /v1/biblioteca/item ⇒ assinante).
  //   sampleDate = data da amostra a linkar (a da semana do diário ou a mais recente); null → sem banner.
  return '<div id="rp-weekly" class="wsamplebox" style="display:none"></div>' +
    '<div id="rp-memo" class="memo"></div>' +
    '<script src="/vendor/supabase-js/supabase.min.js"></script>' +
    '<script>(function(){if(!window.supabase)return;' +
    'var box=document.getElementById("rp-memo");if(!box)return;' +
    'var EN=/radarperene\\.com$/i.test(location.hostname)&&!/\\.com\\.br$/i.test(location.hostname);' +
    'var ANON=' + J(NARR_ANON) + ',DATE=' + J(date) + ',WDATE=' + J(sampleDate || null) + ';' +
    'function showW(){if(!WDATE)return;var w=document.getElementById("rp-weekly");if(!w)return;var u=(EN?"/weekly/":"/semanal/")+WDATE+"/";w.innerHTML=\'<a class="wsample" href="\'+u+\'"><span class="wt">\'+(EN?"Weekly report \\u00b7 free sample":"Relat\\u00f3rio semanal \\u00b7 amostra aberta")+\'</span><span class="wd">\'+(EN?"The week on one page \\u2014 read the free sample \\u2192":"A semana em uma p\\u00e1gina \\u2014 leia a amostra gratuita \\u2192")+\'</span></a>\';w.style.display="block";}' +
    'function hideW(){var w=document.getElementById("rp-weekly");if(w)w.style.display="none";}' +
    'var sb=window.supabase.createClient("https://zcjtkgltrxdnlacezpny.supabase.co",ANON,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"implicit"}});' +
    'function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}' +
    'function inl(s){return esc(s).replace(/\\*\\*([^*]+)\\*\\*/g,"<strong>$1</strong>").replace(/(^|[^*])\\*([^*]+)\\*/g,"$1<em>$2</em>").replace(/&lt;sub&gt;/g,"<span class=\\"selo\\">").replace(/&lt;\\/sub&gt;/g,"</span>");}' +
    'function md(t){var bs=String(t||"").replace(/\\r/g,"").split(/\\n{2,}/),o=[];bs.forEach(function(b){b=b.trim();if(!b)return;if(/^#{1,3}\\s/.test(b)){var h=b.match(/^#+/)[0].length;o.push("<h"+h+">"+inl(b.replace(/^#+\\s/,""))+"</h"+h+">");return;}if(/^---+$/.test(b)){o.push("<hr>");return;}var ls=b.split("\\n");if(ls.every(function(l){return /^[-*]\\s/.test(l.trim());})){o.push("<ul>"+ls.map(function(l){return "<li>"+inl(l.replace(/^[-*]\\s/,""))+"</li>";}).join("")+"</ul>");return;}o.push("<p>"+ls.map(inl).join("<br>")+"</p>");});return o.join("");}' +
    'function gancho(){box.innerHTML=\'<div class="memogate"><div class="gh">\'+(EN?"The full reading is for subscribers":"A leitura completa \\u00e9 para assinantes")+\'</div><p>\'+(EN?"Daily, weekly and monthly reports \\u2014 subscribers only.":"Relat\\u00f3rios di\\u00e1rios, semanais e mensais \\u2014 exclusivos para assinantes.")+\'</p><div class="ghb"><a class="gl" href="\'+(EN?"/subscribe":"/assine")+\'">\'+(EN?"Get the Friday edition \\u2192":"Receba a edi\\u00e7\\u00e3o de sexta-feira \\u2192")+\'</a> <a href="#" id="rp-login" class="lg">\'+(EN?"Already a subscriber? Sign in":"J\\u00e1 \\u00e9 assinante? Entrar")+\'</a></div></div>\';var lg=document.getElementById("rp-login");if(lg)lg.onclick=function(e){e.preventDefault();sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.href}});};}' +
    // loadItem: corpo gateado de um memo (tipo+data_referencia). null se não-publicado OU não-assinante (403).
    'function loadItem(tipo,dref,tok){return fetch(location.origin+"/api/v1/biblioteca/item?tipo="+tipo+"&data="+dref+(EN?"&lang=en":""),{headers:{apikey:ANON,Authorization:"Bearer "+tok}}).then(function(r){return r.ok?r.json():null;}).then(function(d){return (d&&d.corpo_md)?d:null;}).catch(function(){return null;});}' +
    // coveringDref: usa o índice PÚBLICO (/v1/biblioteca?tipo=) p/ achar a data_referencia que cobre DATE —
    //   mensal = mesmo ano-mês; semanal = a data_referencia (fim de semana) dentro de [DATE, DATE+7).
    'function coveringDref(tipo){return fetch(location.origin+"/api/v1/biblioteca?tipo="+tipo+(EN?"&lang=en":""),{headers:{apikey:ANON}}).then(function(r){return r.ok?r.json():null;}).then(function(j){var arr=(j&&j.itens)||[];if(tipo==="mensal"){var ym=DATE.slice(0,7);for(var i=0;i<arr.length;i++){if(String(arr[i].data_referencia).slice(0,7)===ym)return arr[i].data_referencia;}return null;}var best=null;for(var k=0;k<arr.length;k++){var dr=arr[k].data_referencia;if(dr>=DATE){var diff=(Date.parse(dr)-Date.parse(DATE))/86400000;if(diff>=0&&diff<7&&(!best||dr<best))best=dr;}}return best;}).catch(function(){return null;});}' +
    // renderTabs: botões Diário/Semanal/Mensal (só os publicados p/ o dia); abre o que o assinante clicar.
    'function renderTabs(tabs){var L={diario:[(EN?"Daily":"Di\\u00e1rio"),(EN?"Daily report":"Relat\\u00f3rio di\\u00e1rio")],semanal:[(EN?"Weekly":"Semanal"),(EN?"Weekly report":"Relat\\u00f3rio semanal")],mensal:[(EN?"Monthly":"Mensal"),(EN?"Monthly report":"Relat\\u00f3rio mensal")]};var btns="";for(var i=0;i<tabs.length;i++){btns+=\'<button class="memotab\'+(i===0?" on":"")+\'" data-i="\'+i+\'">\'+L[tabs[i].tipo][0]+\'</button>\';}box.innerHTML=\'<div class="memohd">\'+(EN?"Reports for this day":"Relat\\u00f3rios deste dia")+\'</div><div class="memotabs">\'+btns+\'</div><div class="memobody" id="rp-mb"></div>\';var mb=document.getElementById("rp-mb");var bs=box.querySelectorAll(".memotab");function sel(i){for(var j=0;j<bs.length;j++){bs[j].className="memotab"+(j===i?" on":"");}var t=tabs[i];var graf="";if(t.tipo==="diario"&&t.dref){var gb="https://zcjtkgltrxdnlacezpny.supabase.co/storage/v1/object/public/web/email/"+t.dref+"/";graf=["anima","risco_perene"].map(function(g){return \'<img class="memograf" loading="lazy" alt="\'+g+\'" src="\'+gb+g+\'.png" onerror="this.remove()">\';}).join("");if(graf)graf=\'<div class="memografs">\'+graf+\'</div>\';}mb.innerHTML=\'<div class="memohd2">\'+L[t.tipo][1]+(t.dref?" \\u00b7 "+t.dref:"")+\'</div>\'+md(t.data.corpo_md)+graf;}for(var b=0;b<bs.length;b++){(function(b){bs[b].onclick=function(){sel(b);};})(b);}sel(0);}' +
    'async function run(){try{var sess=(await sb.auth.getSession()).data.session;if(!sess){gancho();showW();return;}var tok=sess.access_token;var tabs=[];' +
    'var dd=await loadItem("diario",DATE,tok);if(dd)tabs.push({tipo:"diario",dref:DATE,data:dd});' +
    'var sref=await coveringDref("semanal");if(sref){var sd=await loadItem("semanal",sref,tok);if(sd)tabs.push({tipo:"semanal",dref:sref,data:sd});}' +
    'var mref=await coveringDref("mensal");if(mref){var mdd=await loadItem("mensal",mref,tok);if(mdd)tabs.push({tipo:"mensal",dref:mref,data:mdd});}' +
    'if(!tabs.length){gancho();showW();return;}hideW();renderTabs(tabs);}catch(e){gancho();showW();}}' +
    'sb.auth.onAuthStateChange(function(){run();});run();' +
    '})();<\/script>';
}
// ── A17 Ato 3.1 — a manchete do dia é o H1: promove a 1ª frase da voz (conclusão primeiro) e a REMOVE
//    do corpo (sem duplicar); só promove quando o 1º parágrafo é texto plano. Sem voz → H1 institucional.
function _promoverManchete(html) {
  const m0 = String(html || "").match(/^\s*<p>([^<]+)<\/p>/);
  if (!m0) return null;
  const t = m0[1].replace(/\s+/g, " ").trim();
  const s = t.match(/^(.{25,160}?[.!?…])(\s+|$)/);
  if (!s) return null;
  const resto = t.slice(s[0].length).trim();
  return { manchete: s[1], html: (resto ? "<p>" + resto + "</p>" : "") + String(html).slice(m0[0].length) };  // slice, não replace: "$&"/"$`" no resto corrompiam via replacement-string
}
// ── A17 Ato 3.4 / A15-01 — "O arquivo lembra": 2 portas do acervo, determinísticas pela data (zero LLM).
const _LEMBRA = [
  { pt: ["2011-x-2013-sustos-importados", "2011 × 2013 — sustos importados"], en: ["2011-vs-2013-imported-shocks", "2011 vs 2013 — imported shocks"] },
  { pt: ["2013-x-2024-quando-o-cambio-dita", "2013 × 2024 — quando o câmbio dita"], en: ["2013-vs-2024-when-the-currency-leads", "2013 vs 2024 — when the currency leads"] },
  { pt: ["2018-x-2020-capital-antes-da-fe", "2018 × 2020 — o capital antes da fé"], en: ["2018-vs-2020-capital-before-faith", "2018 vs 2020 — capital before faith"] },
  { pt: ["2022-x-2015-duas-contracoes-lentas", "2022 × 2015 — duas contrações lentas"], en: ["2022-vs-2015-two-slow-contractions", "2022 vs 2015 — two slow contractions"] },
];
function _lembraHtml(date, en) {
  const i = (parseInt(date.slice(8, 10), 10) + parseInt(date.slice(5, 7), 10)) % _LEMBRA.length;
  const base = en ? "/articles/" : "/artigos/";
  const pick = [_LEMBRA[i], _LEMBRA[(i + 1) % _LEMBRA.length]].map(function (e) { const a = en ? e.en : e.pt; return '<a href="' + base + a[0] + '/">' + a[1] + "</a>"; });
  return '<p class="lembra"><span class="lb">' + (en ? "The archive remembers" : "O arquivo lembra") + "</span> " + pick.join(" · ") + "</p>";
}
function _renderDiarioDia(snap, date, origin, lang, nav) {
  nav = nav || {};
  const en = lang === "en";
  const inds = snap.indicadores || [];
  const narr = snap.narrativa || {};
  const ver = snap.verificacao || null;
  const dpath = en ? "/daily" : "/diario";  // slug i18n: EN usa /daily, PT /diario (o .com 301-redireciona /diario→/daily)
  const canon = origin + dpath + "/" + date;
  const regime = inds.find(function (i) { return i.slug === "regime-br"; });
  // ★ item 30 (opção 2, dono 2026-06-11): manchete diária = o que muda TODO dia (Índice de Risco Perene + Ânima);
  //   o regime BR é MENSAL por construção (market_regime_signals deriva de séries mensais; o ponto nasce no fecho)
  //   → desce a "Contexto do mês", ROTULADO. Sem isso, 8 diários seguidos com 28,8 liam como "sistema parado"
  //   (fricção #12 das personas). Apresentação apenas — dado congelado intacto, sem método novo.
  const perene = inds.find(function (i) { return i.slug === "indice-risco-perene"; });
  const anima = inds.find(function (i) { return i.slug === "indice-anima"; });
  const refMes = (regime && regime.ref_mes) || null;  // congelados pré-rótulo não trazem ref_mes → rotula só a cadência (não inventa mês)
  const title = "Radar Perene — " + date + (en ? " · Brazil market regime" : " · regime do mercado BR");
  // ★ 2026-07-04: data EDITORIAL na tela ("3 de julho de 2026"), não ISO — o ISO segue no <title>/og/schema/URL p/ o
  //   buscador. Parse por partes (sem new Date → zero risco de fuso off-by-one). Fallback = data crua (nunca quebra).
  const _MES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const _MES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const _dp = String(date).split("-");
  const _dtEd = (_dp.length === 3 && _MES_PT[+_dp[1] - 1]) ? (en ? _MES_EN[+_dp[1] - 1] + " " + (+_dp[2]) + ", " + _dp[0] : (+_dp[2]) + " de " + _MES_PT[+_dp[1] - 1] + " de " + _dp[0]) : date;
  const _rl = regime ? (regime.classificacao || regime.leitura || "") : "", _rs = (regime && regime.valor != null) ? regime.valor + "/100" : "";
  // ★ 2026-07-04 (diretoria/consultor · Canônico Diário Público G2): o PULSO não traz mais a tradução didática
  //   (risk-on / pessimismo extremo). O ativo que a casa constrói é o NOME DO ÍNDICE, não a legenda — a tradução
  //   mora na metodologia/conceitos. Score inteiro (menos "terminal"). Duas formas: _pulse (meta desc, nome curto,
  //   compacto) e _pulseVis (visível, nome CHEIO — reforça a identidade própria). "Como interpretar?" fica no link discreto.
  const _rnd = (v) => v == null ? null : Math.round(Number(v));
  const _pP = perene && perene.valor != null ? _rnd(perene.valor) : null;
  const _pA = anima && anima.valor != null ? _rnd(anima.valor) : null;
  // ★ humor de CURTO PRAZO (63d) — vitrine da divergência estrutural×curto (dono 2026-07-06: índice é
  //   vitrine pública que vende o relatório; ouro = por-ticker institucional). Vem aninhado em indice_anima.curto.
  const _ipAnima = (snap.indices_proprietarios && snap.indices_proprietarios.anima) || {};
  const _pAc = _ipAnima.curto && _ipAnima.curto.valor != null ? _rnd(_ipAnima.curto.valor) : null;
  const _pulse = [_pP != null ? (en ? "Perene Risk " : "Risco Perene ") + _pP + "/100" : null,
    _pA != null ? "Ânima " + _pA + "/100" : null].filter(Boolean).join(" · ");
  const desc = _esc((en
    ? "Daily reading " + date + (_pulse ? ": " + _pulse : "") + (_rl ? " · month regime: " + _rl + (_rs ? " (" + _rs + ", monthly)" : "") : "") + ". Archived by Radar Perene."
    : "Leitura de " + date + (_pulse ? ": " + _pulse : "") + (_rl ? " · regime do mês: " + _rl + (_rs ? " (" + _rs + ", mensal)" : "") : "") + ". Arquivo diário do Radar Perene.")).slice(0, 155);
  // Verificação (desfecho vs leitura) REMOVIDA do snapshot público — 2ª compressão editorial 2026-06-14:
  //   abria o dia com algo secundário (densidade visual). O dado segue intacto no /v1/snapshot.verificacao;
  //   vai para uma futura página dedicada de track record (/historico). Aqui o dia abre pelo PULSO.
  void ver;
  // ── Casos análogos — "o que veio depois" (olha pra FRENTE): distribuição de desfechos após leituras semelhantes,
  //    pareada com a Verificação (que olha pra trás). Frequência observada, NUNCA previsão. Consome /v1/snapshot.casos_analogos. ──
  const cas = snap.casos_analogos || null;
  let casHtml = "";
  if (cas && cas.horizontes && (cas.horizontes["3m"] || cas.horizontes["6m"] || cas.horizontes["12m"])) {
    const sgn = function (v) { return (v >= 0 ? "+" : "") + v + "%"; };
    // 2ª compressão editorial (2026-06-14): no público, só hit% + mediana. A "cozinha" (faixa p25-p75, n,
    //   n_episodios, k-NN/método) sai → vira moat Founder + link de metodologia. "esconde a escala, não o método".
    const casLines = ["3m", "6m", "12m"].filter(function (k) { return cas.horizontes[k]; }).map(function (k) {
      const h = cas.horizontes[k];
      return k.toUpperCase() + ": " + (en ? "higher " : "em alta ") + h.alta_pct + "%" +
        (h.mediana != null ? " · " + (en ? "median " : "mediana ") + sgn(h.mediana) : "");
    });
    const casTitle = cas.titulo || (en ? "Analogous cases — what came next" : "Casos análogos — o que veio depois");
    const casEx = (cas.exemplos && cas.exemplos.length ? (en ? "e.g. " : "ex. ") + _esc(cas.exemplos.slice(0, 3).join(", ")) : "");
    const casFoot = (en ? "Observed distribution, not a forecast" : "Distribuição observada, não previsão") +
      (casEx ? " · " + casEx : "") +
      " · <a href=\"/conceitos/analogos-historicos/\">" + (en ? "how the analogs are built →" : "como os análogos são construídos →") + "</a>";
    // NÃO renderiza cas.leitura cru no público: a prosa do motor traz a "cozinha" inline
    //   ("N episódios independentes (Ânima/Risco/Regime…), faixa central p25-p75"). Os casLines (hit%+mediana)
    //   + casFoot (disclaimer + exemplos + link de método) já entregam a versão limpa. leitura/faixa = Founder.
    casHtml = "<div class=\"cas\"><b>" + _esc(casTitle) + "</b>" +
      "<ul>" + casLines.map(function (l) { return "<li>" + _esc(l) + "</li>"; }).join("") + "</ul>" +
      "<p class=\"casm\">" + casFoot + "</p>" +
      "</div>";
  }
  // Só "o que veio depois" (casos análogos) no público; a Verificação (olhar pra trás) foi p/ /historico.
  // ★ UX 2026-06-16: "Casos semelhantes" (passado→futuro) é o coração do Radar e deve ter DESTAQUE. Em snapshots
  //   congelados o objeto casos_analogos vem vazio, mas o indicador analogo-br carrega datas+mediana+hit% na leitura
  //   → reconstrói o bloco a partir dele p/ a página nunca perder o "o que veio depois".
  const analogoInd = inds.find(function (i) { return i.slug === "analogo-br"; });
  let casFromInd = "";
  if (!casHtml && analogoInd && analogoInd.leitura) {
    casFromInd = "<div class=\"cas\"><b>" + _esc(en ? "Similar cases — what came next" : "Casos semelhantes — o que veio depois") + "</b>" +
      "<p class=\"casl\">" + _esc(analogoInd.leitura) + "</p>" +
      "<p class=\"casm\">" + (en ? "Observed distribution, not a forecast" : "Distribuição observada, não previsão") +
      " · <a href=\"/conceitos/analogos-historicos/\">" + (en ? "how the analogs are built →" : "como os análogos são construídos →") + "</a></p></div>";
  }
  const pfHtml = casHtml || casFromInd || "";
  const IND_OK = { "regime-br": 1, "ciclicas-defensivas": 1, "ibovespa": 1, "analogo-br": 1 };  // slugs com página /indicador real (★ 2026-07-03: erp-br/valuation-br FORA do público — CVM)
  const CONC_MAP = { "regime-global": "regime-global", "intermercado-br": "intermercado-br" };  // reconstruídos → página de conceito (não /indicador, que 404ava)
  const _indLi = function (i) {
    const nm = IND_OK[i.slug] ? "<a href=\"/indicador/" + _esc(i.slug) + "\">" + _esc(i.nome) + "</a>" : (CONC_MAP[i.slug] ? "<a href=\"/conceitos/" + CONC_MAP[i.slug] + "/\">" + _esc(i.nome) + "</a>" : _esc(i.nome));
    // a leitura já é auto-contida (traz o número) → não repetir o valor em <b> (eliminava "nome valor — leitura valor")
    const body = i.leitura ? _esc(i.leitura) : (i.valor != null ? "<b>" + _esc(_fmtVal(i.valor, i.unidade)) + "</b>" : "");
    return "<li><b>" + nm + "</b>" + (body ? " — " + body : "") + "</li>";
  };
  // item 30: o regime SAI da lista diária → bloco próprio "Contexto do mês", rotulado mensal (+ ref. quando o snapshot traz)
  // ★ UX 2026-06-16: hierarquia em blocos. "O que chama atenção" = indicadores do dia MENOS os que têm bloco próprio
  //   (Pulso: Ânima/Perene/Ibovespa · Casos: analogo-br · Contexto mensal: regime-br) → 3-4 itens em vez de 8.
  const _NO_ATENCAO = { "regime-br": 1, "analogo-br": 1, "indice-anima": 1, "indice-risco-perene": 1, "ibovespa": 1, "erp-br": 1, "valuation-br": 1 };  // ★ 2026-07-03: valuation/ERP fora do diário público (CVM)
  const indHtml = inds.filter(function (i) { return !_NO_ATENCAO[i.slug]; }).map(_indLi).join("");
  const ibov = inds.find(function (i) { return i.slug === "ibovespa"; });
  const ibovHtml = ibov && ibov.leitura ? "<p class=\"casl\">Ibovespa — " + _esc(ibov.leitura) + "</p>" : "";
  // ★ 2026-07-04 (consultor · Canônico G2): o "Pulso do dia" é OBJETO EDITORIAL, não continuação da frase — a temperatura
  //   na capa de um jornal. Nome pequeno em cima, NÚMERO grande embaixo, "/100" quase invisível; sem cor/barra/ícone/badge.
  //   Calma = autoridade; reconhecível em <1s. A prosa do regime (voz) vem depois, como texto. "Como interpretar?" discreto.
  const _pItem = (nm, n) => n == null ? "" : "<div class=\"pulse-i\"><span class=\"pulse-nm\">" + nm + "</span><span class=\"pulse-n\">" + n + "<span class=\"pulse-u\">/100</span></span></div>";
  const _pItems = _pItem(en ? "Perene Risk Index" : "Índice de Risco Perene", _pP) + _pItem(en ? "Ânima Index · structural" : "Índice Ânima · estrutural", _pA) + _pItem(en ? "Ânima · short-term" : "Ânima · curto prazo", _pAc);
  const mancheteHtml = _pItems ? "<div class=\"pulse\"><div class=\"pulse-eyb\">" + (en ? "Today’s pulse" : "O pulso do dia") + "</div><div class=\"pulse-g\">" + _pItems + "</div><a class=\"pulse-help\" href=\"" + (en ? "/how-to-read-the-radar/" : "/como-ler-o-radar/") + "\">" + (en ? "how to read?" : "como interpretar?") + "</a></div>" : "";
  const ctxHtml = regime ? "<div class=\"mctx\"><b>" + (en ? "Month context — BR regime (monthly" : "Contexto do mês — regime BR (mensal") + (refMes ? " · ref. " + _esc(refMes) : "") + ")</b><ul>" + _indLi(regime) + "</ul><p class=\"casm\">" + (en ? "Monthly by construction — the score only moves at month-end; the daily variation lives in the indices above." : "Mensal por construção — o score só se move no fecho do mês; a variação diária está nos índices acima.") + "</p></div>" : "";
  // ★ A VOZ DO MOTOR (2026-06-17): a leitura canônica do dia em prosa editorial (2 parágrafos + 3 bullets
  //   dinâmicos), vinda do snapshot CONGELADO (narr.texto_html, zero LLM). É o HERÓI do diário — conclusão
  //   primeiro, estilo nota editorial. Substitui o antigo "O que chama atenção" (dump) + "Contexto do mês".
  const _pm = _promoverManchete(narr.texto_html);  // A17 3.1: manchete sai do corpo quando promovida
  const _vozCorpo = _pm ? _pm.html : narr.texto_html;
  const vozHtml = _vozCorpo ? "<div class=\"voz\">" + _vozCorpo + "</div>" : "";
  void indHtml; void ibovHtml; void ctxHtml; // subsumidos pela voz (mantidos calculados p/ fallback futuro)
  // Anúncios (gateados pelo /ads.js — Founder não vê): igual aos capítulos. In-article entre a prosa e os
  //   "casos semelhantes" (só quando há prosa, p/ não anunciar em snapshot magro); Multiplex DEPOIS dos casos
  //   e ANTES do _memoGate (mantém o anúncio longe do CTA de conversão). SEO alto + leitor do Google = quase sempre free.
  const inArticleSlot = vozHtml ? "<div class=\"ad-slot\" data-ad-type=\"in-article\" style=\"margin:18px 0\"></div>" : "";
  const multiplexSlot = "<div class=\"ad-slot\" data-ad-type=\"multiplex\" style=\"margin:26px 0 4px\"></div>";
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "Dataset", "name": title, "description": desc, "url": canon, "inLanguage": en ? "en" : "pt-BR", "datePublished": date, "dateModified": date, "isAccessibleForFree": true, "creator": { "@type": "Organization", "name": "Radar Perene", "url": origin + "/" } }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"icon\" href=\"/favicon.ico\" sizes=\"48x48\"><link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/favicon-32x32.png\"><link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/favicon-16x16.png\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-light.svg\" media=\"(prefers-color-scheme: light)\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-dark.svg\" media=\"(prefers-color-scheme: dark)\"><link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/apple-touch-icon.png\"><link rel=\"mask-icon\" href=\"/safari-pinned-tab.svg\" color=\"#131521\"><link rel=\"manifest\" href=\"/site.webmanifest\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + desc + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/diario/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/daily/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/diario/" + date + "\">" +
    "<meta property=\"og:type\" content=\"article\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + desc + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    "<script type=\"application/ld+json\">" + JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [ { "@type": "ListItem", "position": 1, "name": en ? "Home" : "Início", "item": origin + "/" }, { "@type": "ListItem", "position": 2, "name": en ? "Daily archive" : "Arquivo diário", "item": origin + dpath }, { "@type": "ListItem", "position": 3, "name": date, "item": canon } ] }).replace(/</g, "\\u003c") + "</script>" +
    _chromeCss(".h1m{font-family:var(--serif);font-weight:500;font-size:clamp(23px,3.4vw,33px);line-height:1.3;max-width:32ch;letter-spacing:-.01em}.lembra{font-size:13px;color:var(--dim);margin-top:20px}.lembra a{color:var(--gold-ink);text-decoration:none}.lembra a:hover{text-decoration:underline}.lembra .lb{font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:var(--gold-ink);margin-right:8px}.ver{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem;margin:1.1rem 0}.ver b{color:var(--txt)}.ver ul{margin:.4rem 0 0}.pf{display:flex;flex-wrap:wrap;gap:14px;margin:1.1rem 0}.pf>div{flex:1 1 300px;margin:0}.cas{background:var(--surface2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem}.cas b{color:var(--txt)}.cas ul{margin:.4rem 0 0}.casl{margin:.45rem 0 .2rem;color:var(--txt2);font-size:14px}.casm{margin:.5rem 0 0;font-size:12px;color:var(--dim)}.ctx{font-size:13px;color:var(--dim);margin-top:20px}.cnav{font-size:13px;margin-top:8px;display:flex;justify-content:space-between;gap:12px}.pulse{margin:1rem 0 1.6rem;padding-bottom:1.2rem;border-bottom:1px solid var(--line)}.pulse-eyb{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:1rem}.pulse-g{display:flex;gap:2.6rem;flex-wrap:wrap}.pulse-i{display:flex;flex-direction:column;gap:.25rem}.pulse-nm{font-size:13px;color:var(--dim);font-weight:500;letter-spacing:.01em}.pulse-n{font-family:var(--serif);font-size:46px;line-height:1;color:var(--txt);font-weight:500;font-variant-numeric:tabular-nums}.pulse-u{font-size:15px;color:var(--dim);font-weight:400;margin-left:.15rem}.pulse-help{display:inline-block;margin-top:1.1rem;font-size:12px;color:var(--dim);text-decoration:none}.pulse-help:hover{color:var(--gold-ink);text-decoration:underline}@media(max-width:480px){.pulse-g{gap:1.9rem}.pulse-n{font-size:40px}}.voz{font-family:var(--serif);margin:1rem 0 1.5rem;max-width:64ch}.voz p{font-size:19px;line-height:1.65;color:var(--txt);margin:0 0 .65rem}.voz p.rp-sig{font-size:13px;color:var(--gold-ink);font-style:italic;margin:.15rem 0 1rem}.voz ul.rp-voz-bul{list-style:none;padding:0;margin:.2rem 0 0}.voz ul.rp-voz-bul li{font-family:var(--serif);font-size:15px;color:var(--txt2);padding:.2rem 0 .2rem 1.1rem;position:relative;line-height:1.5}.voz ul.rp-voz-bul li:before{content:'\\2022';color:var(--gold-ink);position:absolute;left:.1rem}.panh{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:1.3rem 0 .3rem}.mctx{background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:.7rem 1rem;margin:1rem 0}.mctx>b{font-size:13px;color:var(--dim);letter-spacing:.04em}.mctx ul{margin:.35rem 0 0;padding-left:1.1rem}.memo{margin:1.3rem 0}.memohd{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-ink);font-weight:600;margin-bottom:.5rem}.memobody{color:var(--txt2);font-size:16px;line-height:1.7;max-width:66ch}.memobody h1{font-family:var(--serif);font-weight:500;font-size:21px;color:var(--txt);margin:.4rem 0 .5rem}.memobody h2{font-family:var(--serif);font-weight:500;font-size:18px;color:var(--txt);margin:1.3rem 0 .4rem}.memobody h3{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--gold-ink);margin:1.2rem 0 .35rem}.memobody p{margin:0 0 .75rem}.memobody ul{margin:0 0 .75rem}.memobody hr{border:0;border-top:1px solid var(--line);margin:1.2rem 0}.memobody em{color:var(--dim)}.memobody .selo{display:block;font-size:12px;color:var(--dim);margin-top:.3rem}.memogate{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:1rem 1.1rem}.memogate .gh{font-family:var(--serif);font-size:18px;color:var(--txt);margin-bottom:.3rem}.memogate p{margin:0 0 .7rem;color:var(--dim);font-size:14px}.memogate .ghb{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.memogate .gl{color:var(--gold-ink);font-weight:600;text-decoration:none;font-size:14.5px}.memogate .gl:hover{text-decoration:underline}.memogate .lg{font-size:13px;color:var(--dim)}.wsamplebox{margin:1.3rem 0}.wsample{display:block;background:var(--surface2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem;text-decoration:none}.wsample:hover{border-color:var(--gold-ink)}.wsample .wt{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-ink);font-weight:600;margin-bottom:.25rem}.wsample .wd{display:block;color:var(--txt2);font-size:15px}.memotabs{display:flex;flex-wrap:wrap;gap:18px;margin:.2rem 0 1rem;border-bottom:1px solid var(--line)}.memotab{background:transparent;border:0;border-bottom:1.5px solid transparent;color:var(--txt2);padding:6px 2px 8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.memotab:hover{color:var(--gold-ink)}.memotab.on{background:transparent;color:var(--gold-ink);border-bottom-color:var(--gold-ink)}.memohd2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-ink);font-weight:600;margin-bottom:.5rem}.memografs{margin:1.1rem 0;display:grid;gap:12px}.memograf{width:100%;max-width:520px;border:1px solid var(--line);border-radius:8px;display:block}") +
    "</head><body>" + _header(en) + "<div class=\"wrap\">" +
    (_pm ? '<h1 class="h1m">' + _pm.manchete + "</h1>" : "<h1>" + (en ? "Brazil market regime" : "Regime do mercado brasileiro") + "</h1>") +
    "<p class=\"dt\">" + (_pm ? (en ? "Brazil market regime · " : "Regime do mercado brasileiro · ") : "") + (nav.num ? (en ? "Edition no. " : "Edição nº ") + nav.num + " · " : (en ? "Edition of " : "Edição de ")) + _dtEd + " · Radar Perene" + (snap.frozen === false ? " · " + (en ? "reconstructed essentials" : "essencial reconstruído") : "") + "</p>" +
    mancheteHtml +
    vozHtml +
    inArticleSlot +
    pfHtml +
    multiplexSlot +
    _memoGate(date, WEEKLY_SAMPLE_DATES.indexOf(date) >= 0 ? date : (WEEKLY_SAMPLE_DATES[WEEKLY_SAMPLE_DATES.length - 1] || null)) +
    _lembraHtml(date, en) +
    "<p class=\"ctx\">" + (en ? "Concepts: " : "Conceitos: ") + "<a href=\"/conceitos/regime-brasil/\">" + (en ? "Brazil Regime" : "Regime Brasil") + "</a> · <a href=\"/conceitos/intermercado-br/\">" + (en ? "Intermarket BR" : "Intermercado BR") + "</a> · <a href=\"/conceitos/analogos-historicos/\">" + (en ? "Historical Analogs" : "Análogos Históricos") + "</a> · " + (en ? "How to read: " : "Como ler: ") + "<a href=\"/como-ler-o-radar/\">" + (en ? "six steps" : "seis passos") + "</a> · <a href=\"/metodologia/\">" + (en ? "Methodology" : "Metodologia") + "</a> · <a href=\"" + (en ? "/track-record" : "/historico") + "\">" + (en ? "Track record" : "Track record") + "</a> · " + (en ? "From the archive: " : "Do acervo: ") + "<a href=\"" + (en ? "/articles/" : "/artigos/") + "\">" + (en ? "essays & precedents" : "artigos e precedentes") + "</a></p>" +
    ((nav.prev || nav.next) ? "<p class=\"cnav\">" + (nav.prev ? "<a href=\"" + dpath + "/" + nav.prev + "\">← " + (en ? "previous edition · " : "edição anterior · ") + nav.prev + "</a>" : "<span></span>") + (nav.next ? "<a href=\"" + dpath + "/" + nav.next + "\">" + nav.next + " · " + (en ? "next edition" : "edição seguinte") + " →</a>" : "<span></span>") + "</p>" : "") +
    "</div></main><footer><a href=\"" + dpath + "\">" + (en ? "← all daily readings" : "← todas as leituras diárias") + "</a> · <a href=\"/\">" + (en ? "full radar" : "radar completo") + "</a> · " + (en ? "Descriptive, not a forecast. Public sources." : "Descritivo, não previsão. Fontes públicas.") + "</footer>" +
    "<script src=\"/ads.js\" defer></script>" + _themeScript() + _CONSENT + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
function _renderDiarioIndex(data, origin, lang) {
  const en = lang === "en";
  const itens = data.itens || [];
  const dpath = en ? "/daily" : "/diario";  // slug i18n: EN /daily, PT /diario
  const canon = origin + dpath;
  const title = en ? "Daily archive — Radar Perene" : "Arquivo diário — Radar Perene";
  const desc = en ? "Brazil's market-regime reading by Radar Perene, archived daily and citable — see what the Radar showed on each date and what followed." : "A leitura do regime do mercado brasileiro pelo Radar Perene, arquivada todo dia e citável — veja o que o Radar mostrou em cada data e o que se seguiu.";
  // ★ item 30 (opção 2): a linha lidera com o que VARIA por dia (intermercado global); o regime BR — mensal por
  //   construção — vem rotulado "(mensal)" p/ o número repetido dentro do mês não ler como "sistema parado".
  //   (Perene/Ânima por dia ainda não vêm neste payload de índice — pedido registrado p/ o backend; dentro de cada
  //   dia a manchete diária já existe.)
  const AD_EVERY = 12;  // In-feed (gateado pelo /ads.js — Founder não vê) a CADA 12 registros (página longa: ~329 datas)
  const rows = itens.map(function (s, i) {
    const rg = s.regime_score != null ? (s.regime_score + "/100" + (s.regime_label ? " · " + s.regime_label : "")) : "—";
    // 30b: a linha PULSA — Perene/Ânima mudam todo dia útil (vêm do /v1/snapshots); regime mensal fica como cauda rotulada
    const dia = [s.perene != null ? (en ? "Perene Risk " : "Perene ") + "<b>" + s.perene + "</b>" : null,
      s.anima != null ? "Ânima <b>" + s.anima + "</b>" : null,
      s.global ? (en ? "global " : "global ") + _esc(s.global) : null].filter(Boolean).join(" · ");
    const li = "<li><a href=\"" + dpath + "/" + s.data + "\">" + s.data + "</a>" + (dia ? " — " + dia : "") + " · <span class=\"mn\">" + (en ? "month regime (monthly): " : "regime do mês (mensal): ") + _esc(rg) + "</span></li>";
    return li + ((i + 1) % AD_EVERY === 0 && i < itens.length - 1 ? "<li class=\"ad-slot\" data-ad-type=\"in-feed\" style=\"list-style:none\"></li>" : "");
  }).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": canon, "inLanguage": en ? "en" : "pt-BR", "isAccessibleForFree": true }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"icon\" href=\"/favicon.ico\" sizes=\"48x48\"><link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/favicon-32x32.png\"><link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/favicon-16x16.png\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-light.svg\" media=\"(prefers-color-scheme: light)\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-dark.svg\" media=\"(prefers-color-scheme: dark)\"><link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/apple-touch-icon.png\"><link rel=\"mask-icon\" href=\"/safari-pinned-tab.svg\" color=\"#131521\"><link rel=\"manifest\" href=\"/site.webmanifest\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + _esc(desc) + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/diario\">" +
    "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/daily\">" +
    "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/diario\">" +
    "<meta property=\"og:type\" content=\"website\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    _chromeCss("p.lead{color:var(--txt2);font-size:15px}.cad{font-size:12.5px;color:var(--dim);background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:10px 13px;margin:14px 0}ul.dlist{list-style:none;padding:0}ul.dlist li{padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}ul.dlist li a{font-variant-numeric:tabular-nums;margin-right:6px}ul.dlist .mn{color:var(--dim)}") +
    "</head><body>" + _header(en) + "<div class=\"wrap\"><h1>" + _esc(title) + "</h1><p class=\"lead\">" + _esc(desc) + "</p>" +
    "<p class=\"cad\">" + (en ? "Cadence: monthly (month-end) through 2026-05-30; daily (business days) from then on. The BR regime score is monthly by construction — it only moves at month-end, so it repeats within a month; the daily variation (Perene Risk Index, Ânima, intermarket) lives inside each day’s page." : "Cadência: mensal (fim de mês) até 30/05/2026; diária (dias úteis) a partir daí. O score do regime BR é mensal por construção — só se move no fecho do mês, então repete dentro do mês; a variação diária (Índice de Risco Perene, Ânima, intermercado) está dentro da página de cada dia.") + "</p>" +
    "<ul class=\"dlist\">" + rows + "</ul>" +
    "<div class=\"ad-slot\" data-ad-type=\"multiplex\" style=\"margin:26px 0 0\"></div>" +
    "</div></main><footer><a href=\"/\">" + (en ? "← Full radar" : "← Radar completo") + "</a></footer>" +
    "<script src=\"/ads.js\" defer></script>" + _themeScript() + _CONSENT + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

// ── /historico (PT) | /track-record (EN) — track record auditável: leitura vs. desfecho real (6m) ──
//    Recebe /v1/historico (leituras maturadas: realizado_6m do desfecho + previsto_6m do análogo daquele dia).
//    P7: frequência/desfecho observado, NUNCA previsão/recomendação. É a prova que saiu do /diario na 2ª compressão.
function _renderHistorico(data, origin, lang) {
  const en = lang === "en";
  const itens = (data && data.itens) || [];
  const dpath = en ? "/track-record" : "/historico", ddp = en ? "/daily" : "/diario";
  const canon = origin + dpath;
  const conf = data ? data.direcao_confirmada_pct : null, nComp = (data && data.n_comparaveis) || 0;
  const title = en ? "Track record — readings vs. outcome — Radar Perene" : "Track record — leitura vs. desfecho — Radar Perene";
  const desc = en
    ? "Matured Radar Perene readings vs. what the IBOV actually did 6 months later — an auditable track record. Descriptive, never a forecast."
    : "Leituras já maturadas do Radar Perene vs. o que o IBOV de fato fez 6 meses depois — track record auditável. Descritivo, nunca previsão.";
  const headline = (conf != null && nComp)
    ? (en ? "Across <b>" + nComp + "</b> matured readings, the analog direction was confirmed <b>" + conf + "%</b> of the time (6-month horizon)."
          : "Em <b>" + nComp + "</b> leituras já maturadas, a direção do análogo confirmou <b>" + conf + "%</b> das vezes (horizonte 6 meses).")
    : (en ? "Readings mature as the 6-month outcome becomes known — check back as more accumulate." : "As leituras maturam conforme o desfecho de 6 meses fica conhecido — volte conforme acumulam.");
  const sgn = function (v) { return (v >= 0 ? "+" : "") + v + "%"; };
  const rows = itens.map(function (s) {
    const prev = s.previsto_6m_pct != null ? sgn(s.previsto_6m_pct) : "—";
    const real = s.realizado_6m_pct != null ? sgn(s.realizado_6m_pct) : "—";
    const mk = s.direcao_confirmou == null ? "" : (s.direcao_confirmou ? " <span class=\"ok\">✓</span>" : " <span class=\"no\">✗</span>");
    return "<tr><td><a href=\"" + ddp + "/" + s.data + "\">" + s.data + "</a></td><td>" + (s.regime ? _esc(s.regime) : "—") + "</td><td class=\"n\">" + prev + "</td><td class=\"n\">" + real + mk + "</td></tr>";
  }).join("");
  const thead = en ? "<th>Date</th><th>Month regime</th><th class=\"n\">Analog (6m)</th><th class=\"n\">IBOV outcome (6m)</th>" : "<th>Data</th><th>Regime do mês</th><th class=\"n\">Análogo (6m)</th><th class=\"n\">Desfecho IBOV (6m)</th>";
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": canon, "inLanguage": en ? "en" : "pt-BR", "isAccessibleForFree": true }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"icon\" href=\"/favicon.ico\" sizes=\"48x48\"><link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/favicon-32x32.png\"><link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/favicon-16x16.png\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-light.svg\" media=\"(prefers-color-scheme: light)\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-dark.svg\" media=\"(prefers-color-scheme: dark)\"><link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/apple-touch-icon.png\"><link rel=\"mask-icon\" href=\"/safari-pinned-tab.svg\" color=\"#131521\"><link rel=\"manifest\" href=\"/site.webmanifest\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + _esc(desc) + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/historico\"><link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/track-record\"><link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/historico\">" +
    "<meta property=\"og:type\" content=\"website\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    _chromeCss("p.lead{color:var(--txt2);font-size:15px}.hl{font-family:var(--serif);font-size:20px;line-height:1.45;color:var(--txt);margin:.6rem 0 1.1rem}.hl b{color:var(--gold-ink)}table.trk{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}table.trk th{text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);padding:6px 8px}table.trk td{padding:7px 8px;border-bottom:1px solid var(--line)}table.trk td.n,table.trk th.n{text-align:right}.ok{color:#0f7a43;font-weight:600}[data-theme='dark'] .ok{color:#34c97a}.no{color:var(--dim)}.ctx{font-size:13px;color:var(--dim);margin-top:18px}") +
    "</head><body>" + _header(en) + "<div class=\"wrap\"><h1>" + _esc(title.replace(" — Radar Perene", "")) + "</h1><p class=\"lead\">" + _esc(desc) + "</p>" +
    "<p class=\"hl\">" + headline + "</p>" +
    (rows ? "<table class=\"trk\"><thead><tr>" + thead + "</tr></thead><tbody>" + rows + "</tbody></table>" : "") +
    "<p class=\"ctx\">" + (en ? "Distribution/outcome observed, never a forecast or recommendation. Each reading is frozen on its date; the outcome matures ~6 months later. " : "Distribuição/desfecho observado, nunca previsão ou recomendação. Cada leitura é congelada na sua data; o desfecho matura ~6 meses depois. ") +
    "<a href=\"" + ddp + "\">" + (en ? "All daily readings" : "Todas as leituras diárias") + "</a> · <a href=\"/conceitos/analogos-historicos/\">" + (en ? "Historical Analogs" : "Análogos Históricos") + "</a> · <a href=\"/metodologia/\">" + (en ? "Methodology" : "Metodologia") + "</a></p>" +
    "</div></main><footer><a href=\"/\">" + (en ? "← Full radar" : "← Radar completo") + "</a></footer>" + _themeScript() + _CONSENT + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

export default {
  async fetch(request, env, ctx) {
    // www → apex, 301 (canonical / ads.txt): as rotas www.* apontam para este worker; devolvemos o apex
    // preservando caminho + querystring. Fecha a ponta do www (evita conteúdo duplicado e "ads.txt não encontrado").
    const _wu = new URL(request.url);
    if (_wu.hostname.startsWith("www.")) {
      _wu.hostname = _wu.hostname.slice(4);
      return Response.redirect(_wu.toString(), 301);
    }
    let _resp;
    try { _resp = await _route(request, env, ctx); } catch (e) { _resp = new Response("", { status: 500 }); }
    return _applySec(_resp, request);
  },
};
// ── A: Link de preconnect às origens de fonte (Google Fonts) p/ Early Hints (103). O LCP da home é o H1 serif
//    (Fraunces); o TTFB do worker é represado pelos awaits (digest/narr/ultimas), então o 103 emitido ANTES do
//    corpo abre a conexão TLS ao CDN de fonte durante essa janela. URLs SEM query (sem vírgula/ponto-e-vírgula que
//    quebram o parsing do header Link). CF guarda o Link e replica como 103 nas próximas req (Early Hints ON). ──
const _FONT_LINK = "<https://fonts.googleapis.com>; rel=preconnect, <https://fonts.gstatic.com>; rel=preconnect; crossorigin";
// ── headers de segurança em 1 chokepoint (TODA resposta). Baixo risco; framing liberado só p/ o iframe embed. ──
function _applySec(resp, request) {
  try {
    const h = new Headers(resp.headers);
    h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    h.set("X-Content-Type-Options", "nosniff");
    h.set("Referrer-Policy", "strict-origin-when-cross-origin");
    h.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    h.set("Access-Control-Allow-Origin", "*"); // CORS aberto p/ leitura cross-origin (agentes/ferramentas de agent-readiness como isitagentready leem HTML/llms.txt/robots.txt do navegador); conteúdo 100% público, sem cookies de auth
    if ((resp.headers.get("content-type") || "").includes("text/html") && !h.has("Link")) h.set("Link", _FONT_LINK); // A: só em HTML; não pisa Link já setado
    const _pn = new URL(request.url).pathname;
    // Forma 3 = iframe embedável por terceiros. CF 307-redireciona /radar-embed.html → /radar-embed (extensionless),
    // então AMBOS precisam de frame-ancestors * (senão o iframe quebra em sites de terceiros).
    if (_pn === "/radar-embed" || _pn === "/radar-embed.html") { h.set("Content-Security-Policy", "frame-ancestors *"); }
    else { h.set("X-Frame-Options", "SAMEORIGIN"); h.set("Content-Security-Policy", "frame-ancestors 'self'"); }          // resto: anti-clickjacking
    const noBody = resp.status === 101 || resp.status === 204 || resp.status === 304;
    return new Response(noBody ? null : resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
  } catch (e) { return resp; }
}
// roteador real (envolvido por _applySec acima)
async function _route(request, env, ctx) {
    const _url = new URL(request.url);
    const _isEN = /radarperene\.com$/i.test(_url.hostname.toLowerCase()) && !/\.com\.br$/i.test(_url.hostname.toLowerCase());
    // ★ 2026-07-01: /api/docs consolidada em /widgets (menos "empresa de tecnologia"). 301 nos 2 domínios (antes de servir).
    if (/^\/api\/docs(\/|$)/.test(_url.pathname)) return Response.redirect(_url.origin + "/widgets/", 301);
    // ★ 2026-07-02 Segunda edição G3: slugs que fossilizavam medida estatística → 301 (regra de slug v3/§9.9).
    const _G3_SLUG_301 = {
      "/artigos/o-dolar-em-anomalia-z346-dez-2024": "/artigos/o-dolar-em-anomalia-dez-2024",
      "/artigos/o-salto-de-2-sigma-em-financas-ibov-mar-2016": "/artigos/o-salto-dos-bancos-mar-2016",
      "/artigos/a-divida-publica-em-desvio-raro-ago-2015": "/artigos/a-divida-publica-em-anomalia-rara-ago-2015",
      "/artigos/a-capitulacao-de-quatro-desvios-mai-2025": "/artigos/a-capitulacao-em-financas-mai-2025",
      "/artigos/o-abrigo-a-dois-desvios-dez-2011": "/artigos/o-abrigo-que-cobrava-caro-dez-2011",
      "/artigos/o-agio-dos-bancos-a-dois-desvios-nov-2010": "/artigos/o-agio-dos-bancos-esticado-nov-2010",
      "/artigos/o-ciclo-e-os-bancos-a-quatro-sigmas-out-2018": "/artigos/o-ciclo-e-os-bancos-na-borda-da-escala-out-2018",
      "/artigos/o-defensivo-a-quase-tres-desvios-fev-2024": "/artigos/o-defensivo-esticado-como-quase-nunca-fev-2024",
      "/articles/the-dollar-in-anomaly-z346-dec-2024": "/articles/the-dollar-in-anomaly-dec-2024",
      "/articles/the-2-sigma-leap-in-financials-ibov-mar-2016": "/articles/the-banks-leap-mar-2016",
      "/articles/public-debt-in-a-rare-deviation-aug-2015": "/articles/public-debt-in-a-rare-anomaly-aug-2015",
      "/articles/the-four-sigma-capitulation-may-2025": "/articles/the-capitulation-in-financials-may-2025",
      "/articles/the-two-deviation-shelter-dec-2011": "/articles/the-shelter-that-charged-dearly-dec-2011",
      "/articles/the-banks-premium-at-two-deviations-nov-2010": "/articles/the-banks-premium-stretched-nov-2010",
      "/articles/the-cycle-and-the-banks-four-sigmas-out-oct-2018": "/articles/the-cycle-and-the-banks-at-the-edge-oct-2018",
      "/articles/the-defensive-at-nearly-three-deviations-feb-2024": "/articles/the-defensive-stretched-as-almost-never-feb-2024",
    };
    const _g3old = _url.pathname.replace(/\/$/, "");
    if (_G3_SLUG_301[_g3old]) return Response.redirect(_url.origin + _G3_SLUG_301[_g3old] + "/", 301);
    // ★ 2026-07-03 (dono): conceitos de valuation REMOVIDOS do público (CVM Res.20 — leitura de valor sobre a bolsa é
    //   opinativa) → 301 p/ a umbrella de conceitos, no idioma do path. Público foca regime/intermercado/índices/análogo.
    const _VAL_301 = { "/conceitos/erp-br": 1, "/concepts/erp-br": 1, "/conceitos/cone-de-regressao-logaritmica": 1, "/concepts/logarithmic-regression-cone": 1 };
    if (_VAL_301[_g3old]) return Response.redirect(_url.origin + (_g3old.indexOf("/concepts/") === 0 ? "/concepts/" : "/conceitos/"), 301);
    // ── Páginas de slug COMPARTILHADO (founder, free, widgets): o PT vive em index.html (default no .com.br), o EN em
    //    index.en.html. Sem isto, o build gerava só inglês nos 2 domínios (colisão de slug). No .com servimos a versão EN. ──
    if (_isEN) {
      const _shm = _url.pathname.match(/^\/(founder|free|widgets)\/?$/);
      if (_shm) {
        const _er = await env.ASSETS.fetch(new Request(_url.origin + "/" + _shm[1] + "/index.en.html"));
        if (_er.ok) return _enLibraryRw(_enDailyRw(_consentRw(new HTMLRewriter()))).transform(new Response(_er.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } }));
      }
      // slug i18n do arquivo diário: no .com (EN) /diario → 301 /daily (o conteúdo é o mesmo, só o slug muda; evita slug PT no domínio EN). /daily não redireciona → sem loop.
      if (/^\/diario(\/|$)/.test(_url.pathname)) {
        return Response.redirect(_url.origin + _url.pathname.replace(/^\/diario/, "/daily") + _url.search, 301);
      }
      // landing de assinatura: slug i18n /assine (PT) ↔ /subscribe (EN). No .com (EN) /assine → 301 /subscribe (slug PT não vive no domínio EN). /subscribe não redireciona aqui → sem loop.
      if (/^\/assine(\/|$)/.test(_url.pathname)) {
        return Response.redirect(_url.origin + _url.pathname.replace(/^\/assine/, "/subscribe") + _url.search, 301);
      }
      // biblioteca: slug i18n /biblioteca (PT) ↔ /library (EN). No .com serve /library do asset da biblioteca
      //   (EN-aware) e 301 /biblioteca→/library (slug PT não vive no .com). /library não redireciona → sem loop.
      if (/^\/library(\/|$)/.test(_url.pathname)) {
        const _lr = await env.ASSETS.fetch(new Request(_url.origin + "/biblioteca/index.html"));
        if (_lr.ok) return _enLibraryRw(_enDailyRw(_consentRw(new HTMLRewriter()))).transform(new Response(_lr.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } }));
      }
      if (/^\/biblioteca(\/|$)/.test(_url.pathname)) {
        return Response.redirect(_url.origin + _url.pathname.replace(/^\/biblioteca/, "/library") + _url.search, 301);
      }
    }
    // contraparte PT: no .com.br /subscribe → 301 /assine (mantém o slug EN fora do domínio PT). Gate por host (não !_isEN) p/ não redirecionar em dev/localhost, onde os 2 arquivos servem direto.
    if (/\.com\.br$/i.test(_url.hostname) && /^\/subscribe(\/|$)/.test(_url.pathname)) {
      return Response.redirect(_url.origin + _url.pathname.replace(/^\/subscribe/, "/assine") + _url.search, 301);
    }
    // ── /__purge — invalida o edge-cache da home/digest após novo snapshot (auditoria 2026-06-27 C1). ──
    //    Guardado por env.PURGE_TOKEN (FAIL-CLOSED: sem o secret configurado no Worker, responde 403 sempre).
    //    A wave pode chamar ?token=… ao fim do EOD. ⚠️ caches.default é POR-COLO → apaga só no data center que
    //    atende a chamada; p/ purga GLOBAL usar a Cache Purge API de zona. Best-effort, aditivo, sem efeito até o
    //    dono pôr o secret. Sem ele, o staleness do worker já se auto-cura por SWR em ~30min.
    if (_url.pathname === "/__purge") {
      const _tok = _url.searchParams.get("token") || request.headers.get("x-purge-token");
      if (!env.PURGE_TOKEN || _tok !== env.PURGE_TOKEN) return new Response("forbidden", { status: 403 });
      const _c = caches.default, _langs = ["pt", "en"];
      const _hosts = ["radarperene.com.br", "www.radarperene.com.br", "radarperene.com", "www.radarperene.com"];
      const _ks = [];
      for (const l of _langs) for (const b of ["digest-" + l, "narr-" + l, "ult-" + l]) {
        _ks.push("https://rp-cache.internal/" + b, "https://rp-cache.internal/stale/" + b);
      }
      for (const h of _hosts) for (const l of _langs) for (const d of ["", "/dark"]) {
        _ks.push("https://rp-home.internal/v13/" + h + "/" + l + d, "https://rp-home.internal/v13/" + h + "/" + l + d + "/stale");
      }
      let _n = 0;
      for (const k of _ks) { try { if (await _c.delete(new Request(k))) _n++; } catch (e) { /* best-effort */ } }
      return new Response(JSON.stringify({ purged: _n, of: _ks.length, colo: (request.cf && request.cf.colo) || null }),
        { headers: { "content-type": "application/json" } });
    }
    // ── /sitemap.xml — ÍNDICE de sitemaps (origin-aware): amarra os 4 filhos do MESMO domínio (páginas estáticas +
    //    ativos + indicadores + arquivo diário) num só ponto de submissão. Os diários crescem sozinhos via o filho
    //    sitemap-snapshots.xml (data-driven), então o índice reflete as centenas de URLs sem regenerar nada. ──
    if (_url.pathname === "/sitemap.xml") {
      const o = _url.origin;
      // lastmod no índice = sinal p/ o Google re-buscar os filhos. Os 3 dinâmicos (ativos/indicadores/snapshots) mudam ~diariamente;
      // o de páginas tem lastmod por-URL próprio dentro do filho → hoje no índice é inócuo (não força re-crawl de página inalterada).
      const lm = new Date().toISOString().slice(0, 10);
      const kids = ["/sitemap-pages.xml", "/sitemap-indicadores.xml", "/sitemap-snapshots.xml"];  // ★ /sitemap-ativos REMOVIDO 2026-06-28: /ativo vira founder-gated (público=macro), desindexa orgânico
      const body = '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        kids.map(function (k) { return "<sitemap><loc>" + o + k + "</loc><lastmod>" + lm + "</lastmod></sitemap>"; }).join("") + "</sitemapindex>";
      return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    // ── /sitemap-ativos.xml — VAZIO desde 2026-06-28: /ativo virou founder-gated (público vê só o factual,
    //   noindex). Mantido como urlset vazio (não 404) p/ sinalizar desindexação caso ainda esteja submetido no GSC. ──
    if (_url.pathname === "/sitemap-ativos.xml") {
      return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
    // ── /sitemap-indicadores.xml — sitemap programático de /indicador (DATA-DRIVEN): lista REAL via /v1/indicadores ──
    if (_url.pathname === "/sitemap-indicadores.xml") {
      try {
        const ir = await _fetchIndicadores(_isEN ? "en" : "pt");
        const ij = ir.ok ? await ir.json() : { indicadores: [] };
        const _ilm = ij.data_referencia ? "<lastmod>" + ij.data_referencia + "</lastmod>" : "";  // lastmod = data da leitura do catálogo (todas mudam juntas no pulso diário)
        const _hide = { "erp-br": 1, "valuation-br": 1 };  // ★ 2026-07-03: valuation/ERP fora do público (CVM) — não vão ao sitemap
        const urls = (ij.indicadores || []).filter(function (i) { return i && i.slug && !_hide[i.slug]; }).map(function (i) { return "<url><loc>" + _url.origin + "/indicador/" + encodeURIComponent(i.slug) + "</loc>" + _ilm + "<changefreq>daily</changefreq></url>"; }).join("");
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>", { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
      } catch (e) { return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', { headers: { "content-type": "application/xml" } }); }
    }
    // ── /indicador/{slug} — UMA rota dinâmica p/ QUALQUER indicador (B2 SEO): HTML puro do catálogo único. Indicador novo no catálogo aparece sozinho, sem mexer no worker. ──
    const _im = _url.pathname.match(/^\/indicador\/([a-z0-9-]+)\/?$/);
    if (_im) {
      const slug = _im[1];
      const lang = _isEN ? "en" : "pt";
      // ★ 2026-07-03 (dono): valuation/ERP FORA do público (CVM Res.20) → 301 p/ a umbrella de conceitos
      if (slug === "erp-br" || slug === "valuation-br") return Response.redirect(_url.origin + (_isEN ? "/concepts/" : "/conceitos/"), 301);
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
    // ── /api/* — proxy unificado do edge (radar-api/v1/* · estudos · waitlist). Tira o cliente de cima do supabase.co
    //    direto → edge-cache do /v1/serie anon, domínio único, observabilidade. /api/docs (página) e a
    //    /api/leitura-do-dia.json (handler abaixo) NÃO casam o regex (exige v1/ | estudos | waitlist) → intactas. ──
    {
      const _am = _url.pathname.match(/^\/api\/(v1\/[a-z0-9_\/-]+|estudos|waitlist)$/i);
      if (_am) return _proxyApi(request, _url, _am[1]);
    }
    // ── /api/leitura-do-dia.json — endpoint público (documentado em /api/docs): proxy do edge, CORS aberto, cache 4h ──
    if (_url.pathname === "/api/leitura-do-dia.json") {
      try {
        const r = await _fetchT(LDD_API + "?lang=" + (_isEN ? "en" : "pt"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 14400, cacheEverything: true } });
        const body = r.ok ? await r.text() : '{"erro":"indisponivel"}';
        return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=14400", "access-control-allow-origin": "*" } });
      } catch (e) { return new Response('{"erro":"indisponivel"}', { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } }); }
    }
    // ── /sitemap-snapshots.xml — sitemap programático do arquivo diário (/diario): datas reais via /v1/snapshots ──
    if (_url.pathname === "/sitemap-snapshots.xml") {
      try {
        const sr = await _diarioFetch(SNAPS_API);
        const sj = sr.ok ? await sr.json() : { itens: [] };
        const _dseg = _isEN ? "/daily/" : "/diario/";  // slug i18n: EN /daily, PT /diario
        // ★ lastmod = data do diário → sinal de FRESCOR p/ o Google re-rastrear (descoberta rápida do diário novo, caminho legítimo; complementa o IndexNow do Bing/Yandex). Entrada recente recebe changefreq=daily (pode ser re-enriquecida); arquivo antigo = monthly.
        const _today = new Date().toISOString().slice(0, 10);
        const urls = (sj.itens || []).filter(function (s) { return s && s.data; }).map(function (s) { var fresh = s.data >= _today.slice(0, 7); return "<url><loc>" + _url.origin + _dseg + s.data + "</loc><lastmod>" + s.data + "</lastmod><changefreq>" + (fresh ? "daily" : "monthly") + "</changefreq></url>"; }).join("");
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>", { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
      } catch (e) { return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', { headers: { "content-type": "application/xml" } }); }
    }
    // ── /diario | /daily — índice cronológico do arquivo diário citável (EN usa /daily) ──
    if (_url.pathname === "/diario" || _url.pathname === "/daily") {
      try {
        const r = await _diarioFetch(SNAPS_API + "?lang=" + (_isEN ? "en" : "pt"));
        if (!r.ok) return env.ASSETS.fetch(request);
        return _renderDiarioIndex(await r.json(), _url.origin, _isEN ? "en" : "pt");
      } catch (e) { return env.ASSETS.fetch(request); }
    }
    // ── /historico (PT) | /track-record (EN) — track record: leituras maturadas vs. desfecho (auditabilidade) ──
    if (_url.pathname === "/historico" || _url.pathname === "/track-record") {
      try {
        const r = await _diarioFetch(HIST_API + "?lang=" + (_isEN ? "en" : "pt"));
        if (!r.ok) return env.ASSETS.fetch(request);
        return _renderHistorico(await r.json(), _url.origin, _isEN ? "en" : "pt");
      } catch (e) { return env.ASSETS.fetch(request); }
    }
    // ── /diario/{YYYY-MM-DD} — a foto citável congelada daquele dia + verificação do desfecho ──
    const _dm = _url.pathname.match(/^\/(?:diario|daily)\/(\d{4}-\d{2}-\d{2})$/);
    if (_dm) {
      try {
        const r = await _diarioFetch(SNAP_API + "?date=" + _dm[1] + "&lang=" + (_isEN ? "en" : "pt"));
        if (!r.ok) return new Response((_isEN ? "No reading for " : "Sem leitura para ") + _dm[1], { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
        const nav = {};  // navegação cronológica (lista desc: idx-1 = mais recente = seguinte; idx+1 = anterior)
        try { const sl = await _diarioFetch(SNAPS_API); if (sl.ok) { const ds = ((await sl.json()).itens || []).map(function (x) { return x.data; }); const ix = ds.indexOf(_dm[1]); if (ix >= 0) { nav.next = ix > 0 ? ds[ix - 1] : null; nav.prev = ix < ds.length - 1 ? ds[ix + 1] : null; nav.num = ds.length - ix; } } } catch (e) { /* opcional */ }
        return _renderDiarioDia(await r.json(), _dm[1], _url.origin, _isEN ? "en" : "pt", nav);
      } catch (e) { return env.ASSETS.fetch(request); }
    }
    // ── /ativos — hub crawlável que DE-ORFANIZA as páginas /ativo (Ahrefs #3): links reais via /v1/tickers. 1 rota, língua por hostname. ──
    if (_url.pathname === "/ativos") {
      const en = _isEN;
      let ativos = [];
      try {
        const tr = await _fetchT(NARR_API.replace("/v1/narrative", "/v1/tickers"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 21600, cacheEverything: true } }, 20000);  // ★ /v1/tickers cold ~9,2s > _UPSTREAM_TIMEOUT_MS (9s); 20s cobre o cold, resultado cacheado 6h
        const tj = tr.ok ? await tr.json() : { ativos: [] };
        ativos = (tj.ativos || []).map(function (t) { return String(t).toUpperCase(); }).sort();
      } catch (e) { ativos = []; }
      if (ativos.length) _tickersLast = ativos;                       // guarda o último bom
      const list = ativos.length ? ativos : (_tickersLast || []);     // ★ stale-on-error: soluço do DB NÃO derruba o hub — nunca mais 404
      const fresh = ativos.length > 0;
      const canon = _url.origin + "/ativos";
      const title = en ? "Assets covered — Radar Perene" : "Ativos cobertos — Radar Perene";
      const desc = en ? "Every Brazilian stock, REIT and index with a descriptive Radar Perene reading: price, regime and historical analogs." : "Todas as ações, FIIs e índices brasileiros com leitura descritiva do Radar Perene: preço, regime e análogos históricos.";
      const links = list.map(function (t) { return '<a href="/ativo/' + t.toLowerCase() + '">' + _esc(t) + "</a>"; }).join(" · ");
      const note = list.length ? "" : ("<p class=\"lead\">" + (en ? "The asset list is loading — please try again in a moment." : "A lista de ativos está carregando — tente novamente em instantes.") + " <a href=\"" + (en ? "/daily" : "/diario") + "\">" + (en ? "Daily archive →" : "Arquivo diário →") + "</a></p>");
      const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": canon, "inLanguage": en ? "en" : "pt-BR", "isAccessibleForFree": true }).replace(/</g, "\\u003c");
      const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"icon\" href=\"/favicon.ico\" sizes=\"48x48\"><link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/favicon-32x32.png\"><link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/favicon-16x16.png\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-light.svg\" media=\"(prefers-color-scheme: light)\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-dark.svg\" media=\"(prefers-color-scheme: dark)\"><link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/apple-touch-icon.png\"><link rel=\"mask-icon\" href=\"/safari-pinned-tab.svg\" color=\"#131521\"><link rel=\"manifest\" href=\"/site.webmanifest\">" +
        "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + _esc(desc) + "\">" +
        "<link rel=\"canonical\" href=\"" + canon + "\">" +
        "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/ativos\">" +
        "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/ativos\">" +
        "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/ativos\">" +
        "<meta property=\"og:type\" content=\"website\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + _url.origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
        "<meta name=\"robots\" content=\"noindex,follow\">" +
        "<script>(function(){try{var t=localStorage.getItem('rp_tier');if(t==='founder'||t==='semanal')return;}catch(e){}var E=/radarperene\\.com$/i.test(location.hostname)&&!/\\.com\\.br$/i.test(location.hostname);location.replace(E?'/subscribe':'/assine');})();</script>" +   // 2026-06-30: /ativos só assinante logado (CVM)  // ★ 2026-06-28: hub de tickers é founder-gated (público=macro) → noindex sempre; navega p/ quem acessa, fora do índice
        "<script type=\"application/ld+json\">" + ld + "</script>" +
        _chromeCss("p.lead{color:var(--txt2);font-size:15px}.alist a{text-decoration:none;white-space:nowrap;font-family:var(--mono);font-size:13px;line-height:2.1}input#aq{width:100%;max-width:440px;padding:11px 14px;margin:2px 0 18px;border:1px solid var(--line);border-radius:3px;background:var(--surface);color:var(--txt);font-size:15px;font-family:inherit}.cta-row{margin:26px 0 6px;display:flex;gap:20px;align-items:center;flex-wrap:wrap}.cta-row a.go{color:var(--gold-ink);text-decoration:none;font-weight:600}.adslot{margin:24px 0;min-height:96px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:4px}.adslot span{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);opacity:.55}") +
        "</head><body>" + _header(en) + "<div class=\"wrap\"><h1>" + _esc(title) + "</h1><p class=\"lead\">" + _esc(desc) + "</p>" + note +
        (list.length ? "<input id=\"aq\" type=\"search\" autocomplete=\"off\" placeholder=\"" + (en ? "Search an asset — PETR4, CDI, NVDA…" : "Buscar ativo — PETR4, CDI, NVDA…") + "\">" : "") +
        "<p class=\"alist\">" + links + "</p>" +
        "<div class=\"cta-row\"><a class=\"go\" href=\"" + (en ? "/subscribe" : "/assine") + "\" style=\"font-weight:600\">" + (en ? "Get the Friday edition →" : "Receba a edição de sexta-feira →") + "</a> <a class=\"go\" href=\"/\" style=\"opacity:.85\">" + (en ? "Read today&rsquo;s edition →" : "Ler a leitura de hoje →") + "</a></div>" +
        // ★ AdSense removido do hub /ativos (2026-06-27) — superfície de ticker (Res. CVM 20); coerência com /ativo.
        "</div></main>" +
        "<footer><a href=\"/\">" + (en ? "&larr; Full radar" : "&larr; Radar completo") + "</a></footer>" +
        "<script>(function(){var q=document.getElementById('aq');if(!q)return;var a=[].slice.call(document.querySelectorAll('.alist a'));q.addEventListener('input',function(){var v=q.value.trim().toLowerCase();for(var i=0;i<a.length;i++){a[i].style.display=(!v||a[i].textContent.toLowerCase().indexOf(v)>=0)?'':'none';}});})();</script>" +
        _themeScript() + _CONSENT + "</body></html>";
      // fresh = 6h; stale/vazio = 2min (re-tenta quando o DB voltar). NUNCA 404 → footer/SEO sempre navegáveis.
      return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": fresh ? "public, max-age=21600" : "public, max-age=120" } });
    }
    // ── /ativo/{ticker} — página por ativo (SEO programático B.1): reusa a home shell + widget em modo ativo + narrativa per-ativo ──
    const _am = _url.pathname.match(/^\/ativo\/([a-z0-9_-]{2,44})\/?$/i);  // ★ aceita underscore (us_10y) E hífen+slug longo (slug com underscore ~20c, tesouro-prefixado-com-juros-semestrais-01012031 44c) — {2,14} barrava o catálogo total 2026-06-11
    if (_am) {
      try {
        const tk = _am[1].toUpperCase(), tkLower = _am[1].toLowerCase();
        // ★ resolve a classe REAL (e o nome amigável) do /v1/tickers (cacheado na borda 1h) — antes hardcoded equity_br quebrava US/cripto/commodity/fx/índices
        let cls = /\d11$/.test(tk) ? "fii" : "equity_br", nomeAtivo = tk;
        try { const tr = await _fetchT(NARR_API.replace("/v1/narrative", "/v1/tickers") + "?lang=" + (_isEN ? "en" : "pt"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } }); if (tr.ok) { const tj = await tr.json(); const m = tj.meta && tj.meta[tkLower]; if (m && m.classe) { cls = m.classe; nomeAtivo = m.nome || tk; } } } catch (e) {}
        const lang = _isEN ? "en" : "pt";
        const shell = await env.ASSETS.fetch(new Request(_url.origin + "/"));
        if (!(shell.headers.get("content-type") || "").includes("text/html")) return shell;
        let narr = null;
        try { const nr = await _fetchT(NARR_API + "?codigo=" + tk + "&classe=" + cls + "&lang=" + lang, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } }); if (nr.ok) narr = await nr.json(); } catch (e) {}
        const titulo = nomeAtivo + (lang === "en" ? " — Radar Perene · descriptive reading" : " — Radar Perene · leitura descritiva");
        const desc = (narr && narr.resumo) ? _clampDesc(narr.resumo, 148) : nomeAtivo;
        let rw = new HTMLRewriter()
          .on("title", { element(e) { e.setInnerContent(titulo); } })
          // ★ 2026-06-28: /ativo é founder-gated (público=macro/factual). noindex → desindexa orgânico; fora do sitemap. A página segue acessível (factual p/ anônimo, completa p/ Founder).
          .on('meta[name="robots"]', { element(e) { e.setAttribute("content", "noindex,follow"); } })
          .on('meta[name="description"]', { element(e) { e.setAttribute("content", desc); } })
          .on('meta[property="og:title"]', { element(e) { e.setAttribute("content", titulo); } })
          .on('meta[property="og:description"]', { element(e) { e.setAttribute("content", desc); } })
          // ★ i18n/social (2026-06-16): a shell PT estática deixava twitter:title/description = título da HOME (PT) e
          //   og:locale=pt_BR herdados → no .com vazava PT e em ambos o card social mostrava a home, não o ticker.
          .on('meta[name="twitter:title"]', { element(e) { e.setAttribute("content", titulo); } })
          .on('meta[name="twitter:description"]', { element(e) { e.setAttribute("content", desc); } })
          .on('meta[property="og:locale"]', { element(e) { e.setAttribute("content", _isEN ? "en_US" : "pt_BR"); } })
          .on('meta[property="og:image"]', { element(e) { e.setAttribute("content", _url.origin + (_isEN ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png")); } })  // origin + idioma (era fixo .com.br PT)
          // ★ PÁGINA FOCADA no ticker: esconde as seções de PITCH da home (paraquem/oque/lentes/Free×Founder/…) → mata o conteúdo
          //   quase-duplicado das 252 páginas /ativo. Mantém hero(ticker+busca) + #radar(widget+narrativa) + #faq (contexto+schema).
          //   Conversão segue pelo 🔒 dentro do widget + a FAQ. (.hero não é <section> → permanece.)
          .on("head", { element(e) { e.append("<style>.wrap section:not(#radar):not(#faq){display:none!important}</style>", { html: true }); } })
          // ★ H1/lead do TICKER (o JS da home não sobrescreve mais em /ativo — guard _isHomePg) → 252 páginas com H1≈title coerente
          .on("#h1", { element(e) { e.setInnerContent(nomeAtivo); } })
          .on("#lead", { element(e) { e.setInnerContent(lang === "en" ? ("Descriptive reading of " + nomeAtivo + " — price, historical analogs and regime, observed and remembered. Descriptive, not prediction.") : ("Leitura descritiva de " + nomeAtivo + " — preço, casos análogos e regime, observado e lembrado. Descritivo, não previsão.")); } })
          .on('meta[property="og:url"]', { element(e) { e.setAttribute("content", _url.origin + "/ativo/" + tk.toLowerCase()); } })
          .on("link#rp-canonical", { element(e) { e.setAttribute("href", _url.origin + "/ativo/" + tk.toLowerCase()); } })
          // hreflang self-referente (Ahrefs #4/5): senão herda os do index apontando p/ a home "/"
          .on('link[rel="alternate"][hreflang="pt-br"]', { element(e) { e.setAttribute("href", "https://radarperene.com.br/ativo/" + tk.toLowerCase()); } })
          .on('link[rel="alternate"][hreflang="en"]', { element(e) { e.setAttribute("href", "https://radarperene.com/ativo/" + tk.toLowerCase()); } })
          .on('link[rel="alternate"][hreflang="x-default"]', { element(e) { e.setAttribute("href", "https://radarperene.com.br/ativo/" + tk.toLowerCase()); } })
          .on("#radar-teaser", { element(e) { e.remove(); } })  // teaser da home não faz sentido na página de um ticker → remove (limpo p/ crawler e usuário)
          .on("#radar-perene", { element(e) { e.setAttribute("data-asset", tk); e.setAttribute("data-classe", cls); } })
          .on("html", { element(e) { if (_isEN) e.setAttribute("lang", "en"); } });
        if (_isEN) rw = _enLibraryRw(_enDailyRw(rw)); // /ativo herda a nav da home shell → /diario→/daily e /biblioteca→/library no .com
        // ★ Anúncios REMOVIDOS desta rota /ativo (2026-06-27) — enquadramento regulatório (Res. CVM 20/2021).
        //   /ativo trata de valor mobiliário ESPECÍFICO; veicular AdSense aqui é remuneração indireta e o art. 27-E
        //   da Lei 6.385/76 alcança a atividade "ainda que a título gratuito" — então pré-receita NÃO protege.
        //   O anúncio segue SÓ nas superfícies macro/editoriais (artigos, conceitos, /diario), cujo objeto é
        //   regime/índice e está FORA da Res. 20. NÃO reintroduzir sem credenciamento de analista (CNPI) OU
        //   parecer jurídico. Ver memória: radarperene-estado-e-cvm-2026-06-27.
        if (narr && narr.texto_html) {
          rw = rw.on("#rp-narrative", { element(e) { e.setInnerContent(narr.texto_html, { html: true }); } });
          if (narr.jsonld) { const ld = JSON.stringify(narr.jsonld).replace(/</g, "\\u003c"); rw = rw.on("head", { element(e) { e.append('<script type="application/ld+json">' + ld + '</script>', { html: true }); } }); }
        }
        // ★ BreadcrumbList (AEO/rich results 2026-06-16): Início › Ativos › TICKER — as 252 /ativo não tinham trilha
        const _bc = JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": _isEN ? "Home" : "Início", "item": _url.origin + "/" },
          { "@type": "ListItem", "position": 2, "name": _isEN ? "Assets" : "Ativos", "item": _url.origin + "/ativos" },
          { "@type": "ListItem", "position": 3, "name": nomeAtivo, "item": _url.origin + "/ativo/" + tkLower } ] }).replace(/</g, "\\u003c");
        rw = rw.on("head", { element(e) { e.append('<script type="application/ld+json">' + _bc + '</script>', { html: true }); } });
        return rw.transform(shell);
      } catch (e) { /* falha → segue normal */ }
    }
    const res = await env.ASSETS.fetch(request); // serve o asset estático
    // ★ SEO 2026-06-16: o ASSETS redireciona /path → /path/ com 307 (temporário) — Google/Ahrefs preferem 308
    //   (permanente) p/ consolidar autoridade no canônico com barra. Promove o 307 do trailing-slash a 308.
    if (res.status === 307 && res.headers.get("location")) {
      return new Response(null, { status: 308, headers: { "Location": res.headers.get("location"), "Cache-Control": "public, max-age=86400" } });
    }
    try {
      const url = new URL(request.url);
      const host = url.hostname.toLowerCase();
      const isEN = /radarperene\.com$/i.test(host) && !/\.com\.br$/i.test(host); // só .com (não .com.br)
      const isRoot = url.pathname === "/" || url.pathname === "/index.html";
      const ct = res.headers.get("content-type") || "";
      // ★ 2026-06-21: cartões OG (og-leitura-*.png) mudam 1×/dia via deploy. A CDN do Cloudflare estava segurando o PNG ANTIGO
      //   (cf-cache HIT, etag velho) mesmo após o deploy → no-store força sempre o asset recém-deployado (crawlers = baixo volume).
      if (/^\/og-leitura-[a-z-]*\.png$/.test(url.pathname)) {
        const _oh = new Headers(res.headers); _oh.set("Cache-Control", "no-store"); _oh.delete("ETag");
        return new Response(res.body, { status: res.status, headers: _oh });
      }
      if (!ct.includes("text/html")) return res; // não-HTML: intacto
      if (url.pathname.startsWith("/og/")) return res; // ★ página-fonte do cartão OG — servida PURA (sem barra de consentimento/cobertura) p/ o screenshot sair limpo
      // cobertura VIVA — injeta em QUALQUER página HTML (about/sobre/metodologia/conceitos…); 1 fetch cacheado, barato
      const cob = await _fetchCobertura();
      if (!isRoot) { let rw = _consentRw(new HTMLRewriter()); if (cob) rw = _cobRewriter(rw, cob, isEN); if (isEN) rw = _enLibraryRw(_enDailyRw(rw)); const _t = rw.transform(res); const _h = new Headers(_t.headers); _h.set("content-type", "text/html; charset=utf-8"); return new Response(_t.body, { status: _t.status, headers: _h }); } // não-home: consentimento+analytics + cobertura (+ /diario→/daily no .com). charset EXPLÍCITO: o ASSETS serve "text/html" pelado e webviews (X/LinkedIn in-app) BAIXAM html sem charset em vez de abrir.

      // ★ digest do dia (home payload) inlinado no HTML → o teaser/radar pintam SEM o round-trip cliente (~2-4s, o
      //   gargalo do time-to-insight). Token-agnóstico (handler /v1/digest ignora Authorization) → serve anon+Founder
      //   idêntico, moat intacto. cacheTtl 1800 (muda 1×/dia no pulso) mantém quente. Concorrente com narr/ultimas.
      const _lk = isEN ? "en" : "pt";
      // ★ 2026-06-21: o og:image do home varia por TEMA (?theme=dark → cartão dark). Computado AQUI (antes da chave de cache)
      //   porque a chave precisa incluir o tema — senão o HTML cacheado (og light) era servido p/ ?theme=dark.
      const _ogDark = url.searchParams.get("theme") === "dark";
      // ── B: edge-cache da home RENDERIZADA + SWR (Cache API). O HTML é anon-idêntico por host+lang+tema (digest é
      //    token-agnóstico; o Founder muda só client-side) → seguro cachear. Corta SSR+awaits por request; o digest
      //    muda ~1×/dia, logo 120s fresco + stale 24h (revalida em bg via ctx.waitUntil) é folgado. Chave = host+lang+tema.
      //    NÃO usa o cf-cache (resposta de Worker não é cacheada por header) — daí o Cache API explícito, como _cachedText.
      const _hcache = caches.default, _hk = "https://rp-home.internal/v13/" + host + "/" + _lk + (_ogDark ? "/dark" : ""); // v13 2026-06-21: chave inclui o TEMA (og:image dark)
      const _hserve = (b) => new Response(b, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=120, stale-while-revalidate=600" } });
      const _hok = (b) => b && b.length > 5000; // render completo (home real ~145KB) — NUNCA cacheia/serve vazio ou parcial (anti-poison)
      const _hfresh = await _hcache.match(new Request(_hk));
      if (_hfresh) { const _ff = await _hfresh.text(); if (_hok(_ff)) return _hserve(_ff); } // edge HIT fresco (≤120s) só se completo
      const _renderHome = async () => {
      const _digP = _cachedText(NARR_API.replace("/v1/narrative", "/v1/digest") + "?lang=" + _lk, "digest-" + _lk, 1800);

      // ★ narrativa (AI-readability) + últimas leituras: disparadas JUNTO com o digest (acima) e aguardadas em
      //   PARALELO → o TTFB do worker = MAX(narr, ultimas, digest), não a soma (antes eram await sequencial).
      //   Todas DEFENSIVAS (falha → null, home intacta).
      const _narrP = _cachedJson(NARR_API + "?lang=" + _lk, "narr-" + _lk, 3600);
      const _ultP = _cachedJson(SNAPS_API + "?lang=" + _lk, "ult-" + _lk, 3600);  // 1h (era 4h): na era DIÁRIA a home defasava do /diario (3600) em até 4h — dia novo aparecia no índice e não na vitrine
      let narr = null;
      try { narr = await _narrP; } catch (e) { /* narrativa é opcional — nunca quebra a home */ }
      const _gdt = narr && narr.data_referencia ? String(narr.data_referencia).slice(0, 10) : null;  // data da leitura → dateModified do @graph
      let ultimas = null;
      try { const uj = await _ultP; if (uj) ultimas = (uj.itens || []).slice(0, 4); } catch (e) { /* opcional */ }  // 4: renderiza 3, mas o 3º ainda compara com o dia anterior (continuidade)

      let rw = new HTMLRewriter();
      rw = _cobRewriter(rw, cob, isEN); // cobertura viva também na home (badge/prosa com [data-cob])
      // canonical/og:url da home POR HOST no HTML cru: o index.html estático nasce com ".com" fixo e só o JS
      //   corrigia em runtime — crawler sem JS (Bing 1ª passada, bots de IA) via o .com.br se declarar duplicata
      //   do .com, contradizendo o hreflang pt-br. O renderizado já era self-referente (radar.js); agora o cru também é.
      // ★ 2026-06-21 (dono): OG do home = o CARTÃO da Leitura do Radar (gerado diariamente). Por IDIOMA e por TEMA (_ogDark, def. acima
      //   junto da chave de cache) — o botão de compartilhar anexa ?theme=dark quando o usuário está no escuro → a prévia casa com o tema.
      // ★ 2026-07-03 (dono): a URL do og:image era ESTÁTICA (/og-leitura-pt.png) → o X/LinkedIn cacheiam a prévia PELA URL
      //   e nunca mais re-raspavam, mostrando o cartão de ~19/06 mesmo com o PNG fresco no ar (no-store só resolve a CDN CF,
      //   não o cache dos scrapers sociais). Fix: versiona a URL pela DATA DA LEITURA (_gdt, o conteúdo do cartão) → cada dia
      //   novo é uma URL nova → o X re-busca. Sem leitura (narr null) cai na data UTC do worker. A query é ignorada pelo ASSETS
      //   (casa por pathname) e pelo handler /og-leitura-*.png (regex no pathname), então serve o mesmo PNG.
      const _ogVer = _gdt || new Date().toISOString().slice(0, 10);
      const _ogImg = url.origin + "/og-leitura-" + (isEN ? "en" : "pt") + (_ogDark ? "-dark" : "") + ".png?v=" + _ogVer;
      rw = rw
        .on("link#rp-canonical", { element(e) { e.setAttribute("href", url.origin + "/"); } })
        .on('meta[property="og:url"]', { element(e) { e.setAttribute("content", url.origin + "/"); } })
        .on('meta[property="og:image"]', { element(e) { e.setAttribute("content", _ogImg); } })
        .on('meta[name="twitter:image"]', { element(e) { e.setAttribute("content", _ogImg); } });
      if (isEN) {
        rw = rw
          .on("html", { element(e) { e.setAttribute("lang", "en"); } })
          .on("title", { element(e) { e.setInnerContent(EN_TITLE); } })
          .on('meta[name="description"]', { element(e) { e.setAttribute("content", EN_DESC); } })
          .on('meta[name="keywords"]', { element(e) { e.setAttribute("content", EN_KEYWORDS); } })
          .on('meta[property="og:description"]', { element(e) { e.setAttribute("content", EN_DESC); } })
          .on('meta[name="twitter:description"]', { element(e) { e.setAttribute("content", EN_DESC); } })
          .on('meta[property="og:title"]', { element(e) { e.setAttribute("content", EN_TITLE); } })
          .on('meta[name="twitter:title"]', { element(e) { e.setAttribute("content", EN_TITLE); } })
          .on('meta[property="og:locale"]', { element(e) { e.setAttribute("content", "en_US"); } })
          .on('meta[property="og:locale:alternate"]', { element(e) { e.setAttribute("content", "pt_BR"); } })
          // og:image/twitter:image já resolvidos por idioma+tema acima (_ogImg) — sem override aqui
          .on("#rp-faq-ld", { element(e) { e.setInnerContent(EN_FAQ, { html: true }); } })
          .on("#rp-graph-ld", { element(e) { e.setInnerContent(_graphDated(EN_GRAPH, _gdt), { html: true }); } });
        // SSR-EN do BODY: traduz/preenche cada nó estático PT com o EN do catálogo (idêntico ao que o JS faz em-browser)
        for (const _id in EN_BODY) {
          const _html = EN_BODY[_id];
          rw = rw.on("#" + _id, { element(e) { e.setInnerContent(_html, { html: true }); } });
        }
        // hrefs estáticos PT que o JS troca em-browser → corrige p/ crawler EN
        rw = rw
          .on("#lng-cta", { element(e) { e.setAttribute("href", "/concepts/"); } })
          .on("#l-sobre", { element(e) { e.setAttribute("href", "/about"); } })
          .on("#mail", { element(e) { e.setAttribute("href", "mailto:hello@radarperene.com"); e.setInnerContent("hello@radarperene.com"); } });  // contato EN no .com (PT estático = contato@radarperene.com.br)
        // exemplo de API: PT estático (.com.br) → EN no .com p/ crawler/no-JS (o JS deriva de location.origin no render vivo)
        rw = rw
          .on("#api-url", { element(e) { e.setInnerContent("GET https://radarperene.com/api/v1/digest?lang=en"); } })
          .on("#api-embed", { element(e) { e.setInnerContent('<iframe src="https://radarperene.com/radar-embed" width="100%" height="520" style="border:0"></iframe>'); } });
        rw = _enLibraryRw(_enDailyRw(rw)); // nav/footer/CTA do arquivo diário no .com → /daily + /biblioteca→/library (evita 301)
      } else if (_gdt) {
        // PT: o graph estático vive no index.html → data o Dataset via BUFFER do texto inline (chunks do
        //   HTMLRewriter podem partir a âncora no meio; acumula tudo e emite 1× no último chunk).
        let _gbuf = "";
        rw = rw.on("#rp-graph-ld", { text(t) { _gbuf += t.text; t.remove(); if (t.lastInTextNode) t.replace(_graphDated(_gbuf, _gdt), { html: true }); } });
      }
      if (narr && narr.texto_html) {
        // ★ 2026-06-18 (diretoria): RESUMO visível REMOVIDO da home — o mini-radar acima já carrega o estado e os
        //   análogos, e a prosa repetia. A div #rp-narrative fica vazia → .rp-narr:empty a esconde. NÃO injeta texto.
        //   (O #rp-narrative segue intacto p/ as páginas /ativo, que injetam a narrativa do ticker noutro branch.)
        //   O JSON-LD abaixo (invisível, dados estruturados) PERMANECE — preserva a leitura-por-bots/AEO.
        if (narr.jsonld) {
          const ld = JSON.stringify(narr.jsonld).replace(/</g, "\\u003c"); // emite < escapado p/ </script>-safe no inline (barra dupla; "<" sozinho era no-op)
          rw = rw.on("head", { element(e) { e.append('<script type="application/ld+json">' + ld + '</script>', { html: true }); } });
        }
      }
      if (ultimas && ultimas.length) {
        // ★ 30b TAMBÉM na home (dono 2026-06-11 noite): a vitrine seguia no formato antigo — 28,8 repetido em todo
        //   dia lia como "sistema parado", enquanto o índice /diario já pulsava. MESMA linha do _renderDiarioIndex:
        //   Perene/Ânima (mudam todo dia útil) lideram; o regime BR — mensal por construção — vira cauda ROTULADA.
        //   Entrada da era mensal (sem perene/anima) degrada p/ a linha antiga, sem quebrar.
        // ★ P3 2026-06-18: Diário HUMANIZADO em PROSA (não CSV). Data por extenso → nota do regime com CONTINUIDADE (permaneceu/passou a) +
        //   avaliação de mudança vs o dia anterior (delta do Perene). Vira ativo cumulativo: milhares de notas escritas com o tempo.
        const _MES = isEN ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
          : ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        const _humDate = function (ds) { const p = String(ds).split("-"); if (p.length !== 3) return _esc(ds); const d = parseInt(p[2], 10), m = _MES[parseInt(p[1], 10) - 1] || p[1], y = p[0]; return isEN ? (m + " " + d + ", " + y) : (d + " de " + m + " de " + y); };
        // ★ 2026-06-26 (dono): o resumo LIDERA com o MOVIMENTO de apetite (Perene) e humor (Ânima) — os índices
        //   que mudam todo dia útil — em PROSA (sem número cru); regime BR (mensal) + exterior viram CAUDA curta.
        //   Antes liderava com regime+global (idênticos por construção) → dias saíam iguais. Degrada gracioso:
        //   sem dia anterior / sem Perene (era mensal) cai na nota de regime.
        const _humAp = function (d) {              // apetite por risco (delta do Perene; alto = risk-on)
          if (d >= 5) return isEN ? "Risk appetite rose" : "O apetite por risco subiu";
          if (d >= 2) return isEN ? "Risk appetite edged up" : "O apetite por risco avançou um pouco";
          if (d > -2) return isEN ? "Risk appetite was little changed" : "O apetite por risco ficou praticamente estável";
          if (d > -5) return isEN ? "Risk appetite eased" : "O apetite por risco cedeu um pouco";
          return isEN ? "Risk appetite pulled back" : "O apetite por risco recuou";
        };
        const _humHu = function (d, lvl) {          // humor estrutural (delta do Ânima; baixo = pessimismo)
          const piso = lvl != null && lvl <= 25;
          if (d >= 4) return isEN ? "the mood lifted" : "o humor melhorou";
          if (d >= 1.5) return isEN ? "the mood eased a little" : "o humor ficou um pouco menos deprimido";
          if (d > -1.5) return piso ? (isEN ? "the mood stayed at the floor" : "o humor seguiu no piso")
                                    : (isEN ? "the mood held" : "o humor ficou estável");
          if (d > -4) return isEN ? "the mood slipped" : "o humor recuou";
          return isEN ? "the mood sank to the floor" : "o humor recuou ao fundo da banda";
        };
        const uh = ultimas.slice(0, 3).map(function (s, i) {
          const prev = ultimas[i + 1] || null;  // dia anterior — base do movimento
          let prose;
          if (prev && s.perene != null && prev.perene != null) {
            let lead = _humAp(s.perene - prev.perene);
            if (s.anima != null && prev.anima != null) lead += (isEN ? " and " : " e ") + _humHu(s.anima - prev.anima, s.anima);
            lead += ".";
            const cauda = [];
            if (s.regime_label) cauda.push((isEN ? "Brazil " : "Regime ") + _esc(s.regime_label));
            if (s.global) cauda.push((isEN ? "global backdrop " : "exterior em ") + _esc(s.global));
            prose = lead + (cauda.length ? " " + cauda.join(", ") + "." : "");
          } else {
            // sem base de movimento (1ª entrada / era mensal sem Perene): nota de regime
            const _sent = [];
            if (s.regime_label) _sent.push((isEN ? "Brazil's regime " : "Regime brasileiro ") + _esc(s.regime_label));
            if (s.global) _sent.push((isEN ? "global backdrop " : "exterior em ") + _esc(s.global));
            prose = _sent.length ? (_sent.join(", ") + ".") : ((isEN ? "Monthly regime " : "Regime do mês ") + (s.regime_score != null ? s.regime_score + "/100" : "—") + ".");
          }
          return '<a class="ult" href="' + (isEN ? "/daily/" : "/diario/") + s.data + '"><span class="ultd">' + _humDate(s.data) + '</span><span class="ultp">' + prose + "</span></a>";
        }).join("");
        rw = rw.on("#rp-ultimas", { element(e) { e.setInnerContent(uh, { html: true }); } });
      }
      // ★ inline do digest no FIM do body (não bloqueia o paint do shell; radar.js lê window.__RP_DIGEST no boot).
      //   Opcional/defensivo: falha no fetch → sem inline → radar.js faz o fetch normal (degrada gracioso).
      try {
        const dRaw = await _digP;
        if (dRaw) {
          const dj = dRaw.replace(/</g, "\\u003c"); // emite < p/ todo "<" → </script>-safe no inline
          rw = rw.on("body", { element(e) { e.append('<script>window.__RP_DIGEST=window.__RP_DIGEST||{};window.__RP_DIGEST["' + _lk + '"]=' + dj + ';</script>', { html: true }); } });
        }
      } catch (e) { /* inline é opcional — nunca quebra a home */ }
      return await rw.transform(res).text(); // buffer do HTML reescrito → cacheável
      };
      const _hput = (b) => _hok(b) ? Promise.all([                                                                                                                      // só cacheia render COMPLETO (anti-poison)
        _hcache.put(new Request(_hk), new Response(b, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=120" } })),          // fresco (120s)
        _hcache.put(new Request(_hk + "/stale"), new Response(b, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=86400" } })), // stale (24h)
      ]).catch(function () { }) : Promise.resolve();
      const _hstaleR = await _hcache.match(new Request(_hk + "/stale"));
      if (_hstaleR && ctx && ctx.waitUntil) { const _hs = await _hstaleR.text(); if (_hok(_hs)) { ctx.waitUntil(_renderHome().then(_hput).catch(function () { })); return _hserve(_hs); } } // serve stale (se completo) JÁ + revalida bg
      const _hb = await _renderHome(); // sem stale válido → render inline
      if (_hok(_hb)) { if (ctx && ctx.waitUntil) ctx.waitUntil(_hput(_hb)); return _hserve(_hb); }
      return _hserve(await env.ASSETS.fetch(request).then(function (r) { return r.text(); }).catch(function () { return _hb || ""; })); // render falhou → asset cru (válido), SEM cache
    } catch (e) {
      return res; // nunca quebra: na dúvida, serve o original
    }
  }
