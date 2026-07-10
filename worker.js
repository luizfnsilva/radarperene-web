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
    { "@type": "Question", "name": "How much does it cost and what's included?", "acceptedAnswer": { "@type": "Answer", "text": "Perene Semanal is US$ 29/mo (R$ 29 on .com.br) - the weekly Brazil edition, the archive, and access to each day's open edition. The daily regime reading is free. The full publication — each day's reading, the library and the per-asset reading — is part of institutional access, granted in conversation to credentialed partners." } },
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
    faq: [["When does the weekly edition arrive?", "The weekly edition arrives on Friday, after the market close (around 8:30pm BRT). The free daily reading goes out ~50 minutes before the open, with the prior day&rsquo;s close. The monthly closes on the last day of the month."], ["Are the weekly editions archived?", "Yes — as a subscriber, you receive the Friday editions from your subscription date onward. Perene Semanal is one edition per week; the monthly report library is part of institutional access."], ["How does Radar Perene compute Brazil&rsquo;s macro regime?", "The Radar condenses the Brazilian market into proprietary indices — the Perene Risk Index, ANIMA and the regime reading — built on public data since 2000, with a declared, stable method. The detail lives in the Methodology."], ["How much does it cost and what's included?", "Perene Semanal is US$ 29/mo (R$ 29 on .com.br) — the weekly Brazil edition, the archive, and access to each day&rsquo;s open edition. The daily regime reading is free. The full publication — each day's reading, the library and the per-asset reading — is part of institutional access, granted in conversation to credentialed partners."], ["How do payment and the 7-day window work?", "Payment is taken at signup (R$ on the .com.br domain, US$ on .com), processed by Stripe. You have a 7-day full, automatic refund window — a legal right, no friction. After 7 days the normal recurrence (monthly or annual) continues. Everything is managed by you in the Stripe Customer Portal."], ["How do support, cancellation and data deletion work?", "Your subscription is managed by you in the Stripe Customer Portal — cancellation, refunds, card changes and invoices in one click, anytime. Account and data deletion is also one click in your profile — we store nothing beyond your login and email."], ["Is this investment advice?", "No. Under our P7 protocol the system is strictly descriptive — it reads regimes and anomalies from public sources and never recommends, predicts a price, or gives financial advice."], ["Does Radar Perene make forecasts?", "No. Radar Perene does not predict a price or a point. It works with precedents, historical distributions and probabilities — describing what tended to follow similar environments, with the uncertainty band on display."], ["How do the studies work?", "Each Library study answers one question: what historically happened next when ___? — risk-on/off extreme, extreme pessimism/optimism, strong/weak dollar, Selic hiking/cutting cycle. The answer is the IBOV&rsquo;s empirical distribution over 3/6/12 months (median, % up, and the 50% and 80% bands)."], ["Does the Radar learn?", "Yes — through memory, self-evaluation and historical accumulation, not by rewriting the past. Past readings are confronted with the actual outcome 3/6/12 months later."], ["What are historical analogs?", "Past episodes historically similar to today&rsquo;s environment. Not a forecast — a distribution map: what happened next, with sample size and uncertainty shown."], ["What is the Study Library?", "A collection of editorial objects built from conditional events — regimes, sentiment, liquidity and rates. Each is a citable study: the Radar has a study for that."]]
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
    "fnd-lead": "The mechanisms behind the readings.", "fnd-s": "To see what underpins the readings: the precedents, the historical analogs and the Radar&rsquo;s full reading of each asset.", "fnd-cta": "Institutional access →",
    "sem-eyb": "Subscription", "sem-h": "Perene Semanal", "sem-s": "Every Friday, an edition of what changed, what held, and what the archive remembers.", "sem-cta": "Get the Friday edition →",
    "s-arq": "The present, in conversation with memory", "s-arq-s": "What the Radar recorded — and what came next.",
    "prof-h": "One publication, four depths", "prof-p": 'The <b>Daily</b> is the cover: each day&rsquo;s regime reading, open to all, since 2000. <b><a href="/subscribe" style="color:inherit">Perene Semanal</a></b> (US$ 29/mo) is the Friday edition — what changed, what held, what the archive remembers — with its own archive. The <b>Monthly</b> and the library since 2010 are part of <a href="/founder/" style="color:inherit">institutional access</a>, together with the full reading of each asset — granted in conversation, to credentialed partners. The <b>Vértice</b> letter circulates as a pilot, to a small group of readers.', "prof-links": '<a href="/" style="color:var(--gold-ink)">Read today&rsquo;s open edition →</a> · <a href="/subscribe" style="color:var(--gold-ink)">Get the Friday edition →</a> · <a href="/founder/" style="color:var(--gold-ink)">Institutional access →</a>',
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
const ATLAS_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/atlas";  // agregação do acervo p/ a /atlas
const HIST_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/historico";  // track record (leituras maturadas vs desfecho)
const RECORR_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/recorrencia";  // recorrência descritiva por ESTADO (Perene) — o MESMO número da home
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
// ── v1.0: cor do filete de assinatura do regime (defensivo=ardósia fria; risk_on=terracota apagada; neutro=dourado
//    apagado). Editorial, NUNCA verde/vermelho. Muda com o regime (mensal) — a assinatura que o leitor aprende. ──
function _regimeColor(regRaw) {
  const r = String(regRaw == null ? "" : regRaw).toLowerCase();
  if (/defens/.test(r)) return "#5b6b7a";           // ardósia fria
  if (/risk[_ ]?on|otimis|exuber|amplo/.test(r)) return "#a86b4a";  // terracota apagada (risco ligado)
  if (/neutr/.test(r)) return "#9a8c6e";            // dourado/ardósia quente
  return "#8a7f70";                                  // default discreto
}
// ── ★ v1.0 "O Arquivo Lembra" — a COLUNA fixa, o maior patrimônio. Timeline DETERMINÍSTICA do MESMO regime através do
//    acervo (Há um ano · Há cinco anos · Primeira vez), via /v1/historico (leituras maturadas × desfecho, Ibov em pontos).
//    O diário público NÃO reescreve. Regra dura: indicava×aconteceu SEMPRE na MESMA janela (6m). Baixas em tom NEUTRO,
//    nunca vermelho — "78% confirmada, nem sempre pra cima" constrói mais confiança. Degrada gracioso (sem dado → ""). ──
function _arquivoLembraHtml(hist, todayPerene, todayDate, en, dpath, regimeColor, rec) {
  const items = (hist && hist.itens) || [];
  if (!items.length) return "";
  const matured = function (x) { return x && x.realizado_6m_pct != null && String(x.data).slice(0, 10) < todayDate; };
  // similaridade por ESTADO (Índice de Risco Perene ~ igual), não por regime — coerente com o Atlas e a recorrência.
  const _P0 = (todayPerene != null) ? Number(todayPerene) : null, BANDA = 10;
  let same = (_P0 != null) ? items.filter(function (x) { return matured(x) && x.perene != null && Math.abs(Number(x.perene) - _P0) <= BANDA; }) : [];
  if (!same.length) same = items.filter(matured);   // fallback: acervo maturado (qualquer estado)
  if (!same.length) return "";
  same.sort(function (a, b) { return String(a.data) < String(b.data) ? -1 : 1; });  // asc por data
  const ym = function (d) { return parseInt(String(d).slice(0, 4), 10) * 12 + parseInt(String(d).slice(5, 7), 10); };
  const tgt = ym(todayDate);
  //  tolerância: o nó só recebe o rótulo temporal se estiver DENTRO da janela (o rótulo não pode mentir a data —
  //  a coluna é patrimônio). Fora da janela → null → o marco simplesmente não aparece (degrada p/ "Primeira vez").
  const nearest = function (months, tol) {
    let best = null, bd = 1e9;
    for (let i = 0; i < same.length; i++) { const dd = Math.abs(ym(same[i].data) - (tgt - months)); if (dd < bd) { bd = dd; best = same[i]; } }
    return (best && bd <= tol) ? best : null;
  };
  const seen = {}, picks = [];
  const add = function (lbl, node) { if (node && !seen[node.data]) { seen[node.data] = 1; picks.push({ lbl: lbl, n: node }); } };
  add(en ? "A year ago" : "Há um ano", nearest(12, 5));       // ±5 meses do alvo de 1 ano
  add(en ? "Five years ago" : "Há cinco anos", nearest(60, 24));  // ±2 anos do alvo de 5 anos (marco grosso)
  add(en ? "First time in the archive" : "Primeira vez no arquivo", same[0]);
  if (!picks.length) return "";
  const _MPT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const _MEN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const edate = function (d, full) {   // data editorial: full → "31 de julho de 2025"; senão "julho de 2025"
    const q = String(d).split("-"), mo = (en ? _MEN : _MPT)[(+q[1]) - 1] || q[1];
    if (!full) return en ? mo + " " + q[0] : mo + " de " + q[0];
    return en ? mo + " " + (+q[2]) + ", " + q[0] : (+q[2]) + " de " + mo + " de " + q[0];
  };
  const nf = function (v) { return v == null ? null : Math.round(Number(v)).toLocaleString(en ? "en-US" : "pt-BR"); };  // Ibov em pontos, separador local
  const pct = function (v) { return v == null ? null : Math.round(Number(v)); };  // % ARREDONDADO ao inteiro (editorial)
  const sgnv = function (v) { const r = pct(v); return r == null ? "—" : (r >= 0 ? "+" : "") + r + "%"; };
  const gain = function (v) {   // ganho em terracota (warm), baixa em tom NEUTRO — nunca vermelho
    const r = pct(v); if (r == null) return "—";
    return "<span class=\"arq-pct" + (r >= 0 ? " up" : "") + "\">" + (r >= 0 ? "+" : "") + r + "%</span>";
  };
  // FEATURED = picks[0] (Há um ano, quando existe) — foto detalhada; os demais = one-liners (○).
  const feat = picks[0], fx = feat.n, fd = String(fx.data).slice(0, 10);
  const fAnc = nf(fx.ibov_ancora), fFim = nf(fx.ibov_nivel_6m);
  const featHtml = "<li class=\"arq-no arq-feat\"><div class=\"arq-top\"><span class=\"arq-sym\">●</span><span class=\"arq-quando\">" + _esc(feat.lbl) + "</span><span class=\"arq-data\">" + edate(fd, true) + "</span></div>" +
    (fAnc ? "<div class=\"arq-lin\"><span>" + (en ? "Ibovespa that day" : "Ibovespa no dia") + "</span><span class=\"dl\"></span><span class=\"arq-v\">" + fAnc + " pts</span></div>" : "") +
    (fx.previsto_6m_pct != null ? "<div class=\"arq-lin\"><span>" + (en ? "the archive suggested" : "o arquivo indicava") + "</span><span class=\"dl\"></span><span class=\"arq-v\">" + sgnv(fx.previsto_6m_pct) + (en ? " in 6m" : " em 6 meses") + " <em>" + (en ? "hist. median" : "mediana histórica") + "</em></span></div>" : "") +
    "<div class=\"arq-lin\"><span>" + (en ? "what happened in 6 months" : "o que aconteceu em 6 meses") + "</span><span class=\"dl\"></span><span class=\"arq-v\">" + (fFim ? fFim + " pts " : "") + "(" + gain(fx.realizado_6m_pct) + ")</span></div>" +
    "<a class=\"arq-reler\" href=\"" + dpath + "/" + fd + "\">" + (en ? "Reread the edition of " : "Reler a edição de ") + edate(fd, true) + " →</a></li>";
  const oneHtml = picks.slice(1).map(function (p) {
    const x = p.n, d = String(x.data).slice(0, 10), a = nf(x.ibov_ancora), f = nf(x.ibov_nivel_6m);
    const traj = (a && f) ? "Ibovespa " + a + " → " + f + " pts (" + gain(x.realizado_6m_pct) + (en ? " in 6m)" : " em 6m)") : "(" + gain(x.realizado_6m_pct) + (en ? " in 6m)" : " em 6m)");
    return "<li class=\"arq-no arq-one\"><div class=\"arq-top\"><span class=\"arq-sym o\">○</span><span class=\"arq-quando o\">" + _esc(p.lbl) + "</span><span class=\"arq-data\">" + edate(d, false) + "</span></div>" +
      "<div class=\"arq-oneline\">" + traj + " · <a href=\"" + dpath + "/" + d + "\">" + (en ? "reread →" : "reler →") + "</a></div></li>";
  }).join("");
  const intro = en ? "Other times the archive saw the market in a state like today’s — what came next."
                   : "Outras vezes em que o arquivo viu o mercado num estado como o de hoje — o que veio depois.";
  // RECORRÊNCIA (descritiva, o MESMO número da home): "de N vezes num estado como hoje, o Ibov subiu em X%". Sujeito = o
  //   MERCADO (não o Radar); o arquivo é a testemunha. O "78% direção confirmada" (acurácia) vive só no /historico.
  const _m = rec && rec.mediana_6m != null ? (en ? " — median " : " — mediana ") + (rec.mediana_6m >= 0 ? "+" : "") + (en ? rec.mediana_6m : String(rec.mediana_6m).replace(".", ",")) + "%" : "";
  const foot = (rec && rec.n && rec.alta_pct != null)
    ? (en ? "In <b>" + rec.n + "</b> times the archive saw the market in a state like today’s since 2000, the Ibovespa was higher six months later <b>" + rec.alta_pct + "%</b> of the time" + _m + " — <em>not always upward</em>. "
          : "Em <b>" + rec.n + "</b> vezes que o arquivo viu o mercado num estado como o de hoje, desde 2000, o Ibovespa esteve mais alto seis meses depois em <b>" + rec.alta_pct + "%</b> delas" + _m + " — <em>nem sempre para cima</em>. ")
    : "";
  const style = regimeColor ? " style=\"border-left-color:" + regimeColor + "\"" : "";
  return "<section class=\"arquivo\" id=\"arquivo\"" + style + "><div class=\"arq-h\">" + (en ? "The Archive Remembers" : "O Arquivo Lembra") + " <span class=\"arq-mk\">◎</span></div>" +
    "<p class=\"arq-intro\">" + intro + "</p><ol class=\"arq-tl\">" + featHtml + oneHtml + "</ol>" +
    "<p class=\"arq-foot\">" + foot + "<a href=\"" + (en ? "/track-record" : "/historico") + "\">" + (en ? "Explore the archive →" : "Explorar o arquivo →") + "</a></p></section>";
}

// ── Fase 3 · "Estados semelhantes" — a teia LATERAL do arquivo. Distinto do Arquivo Lembra (que é TEMPORAL:
//    há um ano/há cinco anos). Aqui: outras edições que o arquivo viu num ESTADO parecido (Índice de Risco
//    Perene ~ igual), ordenadas pela proximidade — cada uma um <a> real e crawlável p/ /diario/{data}.
//    Reusa a MESMA banda do Arquivo Lembra (coerência com Atlas + recorrência). Zero termo de motor (P7).
//    Degrada gracioso: sem histórico/sem vizinhos → "" (a página nunca perde render nem quebra).
function _estadosSemelhantesHtml(hist, todayPerene, todayDate, en, dpath, regimeColor) {
  const items = (hist && hist.itens) || [];
  if (!items.length || todayPerene == null) return "";
  const _P0 = Number(todayPerene), BANDA = 8;   // banda um pouco mais estreita que o Lembra (10): "semelhante" = mais próximo
  const cand = items.filter(function (x) {
    return x && x.perene != null && String(x.data).slice(0, 10) !== todayDate
      && Math.abs(Number(x.perene) - _P0) <= BANDA;
  });
  if (cand.length < 2) return "";
  // ordena por proximidade de estado (|Δperene|), desempata por data mais recente
  cand.sort(function (a, b) {
    const da = Math.abs(Number(a.perene) - _P0), db = Math.abs(Number(b.perene) - _P0);
    if (da !== db) return da - db;
    return String(a.data) < String(b.data) ? 1 : -1;
  });
  const _MPT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const _MEN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const edate = function (d) { const q = String(d).split("-"); const mo = (en ? _MEN : _MPT)[(+q[1]) - 1] || q[1]; return en ? mo + " " + (+q[2]) + ", " + q[0] : (+q[2]) + " de " + mo + " de " + q[0]; };
  const seen = {}, picks = [];
  for (let i = 0; i < cand.length && picks.length < 6; i++) {
    const d = String(cand[i].data).slice(0, 10);
    if (seen[d]) continue; seen[d] = 1; picks.push(cand[i]);
  }
  if (picks.length < 2) return "";
  const _pv = function (v) { return en ? Math.round(Number(v)) : String(Math.round(Number(v))); };  // Perene inteiro
  const lis = picks.map(function (x) {
    const d = String(x.data).slice(0, 10);
    const reg = x.regime ? " <span class=\"es-reg\">· " + _esc(x.regime) + "</span>" : "";
    return "<li><a href=\"" + dpath + "/" + d + "\"><span class=\"es-dt\">" + _esc(edate(d)) + "</span>"
      + "<span class=\"es-p\">" + (en ? "Perene " : "Perene ") + _pv(x.perene) + "</span>" + reg + "</a></li>";
  }).join("");
  const intro = en
    ? "Other editions the archive read in a market state close to today’s — same neighbourhood of the Perene Risk Index."
    : "Outras edições que o arquivo leu num estado de mercado próximo ao de hoje — a mesma vizinhança do Índice de Risco Perene.";
  const style = regimeColor ? " style=\"border-left-color:" + regimeColor + "\"" : "";
  return "<section class=\"estados\" id=\"semelhantes\"" + style + ">"
    + "<div class=\"es-h\">" + (en ? "Editions in a similar state" : "Edições em estado semelhante") + "</div>"
    + "<p class=\"es-intro\">" + intro + "</p>"
    + "<ol class=\"es-list\">" + lis + "</ol></section>";
}

// ── Fase 3 · Diário → Atlas POR FENÔMENO. Deriva a porta certa do Atlas a partir do dia: extremo (Perene ≥90/≤10)
//    → coleção de extremos; regime defensivo/risco-ligado → coleção por regime; senão → gavetas gerais. Âncoras que
//    JÁ existem no /atlas (#drawers, #main). P7: descreve o fenômeno, nunca a medida. Devolve {label, href} ou null.
function _atlasPorFenomeno(regimeRaw, pP, en) {
  const r = String(regimeRaw == null ? "" : regimeRaw).toLowerCase();
  if (pP != null && (Number(pP) >= 90 || Number(pP) <= 10)) {
    return { href: "/atlas#drawers", label: en ? "See every extreme like this one in the Atlas →" : "Ver no Atlas todos os extremos como este →" };
  }
  if (/defens/.test(r)) {
    return { href: "/atlas#drawers", label: en ? "Every defensive stretch in the Atlas →" : "Todo o defensivo no Atlas →" };
  }
  if (/risk[_ ]?on|otimis|exuber|amplo/.test(r)) {
    return { href: "/atlas#drawers", label: en ? "Every risk-on stretch in the Atlas →" : "Todo o risco-ligado no Atlas →" };
  }
  return { href: "/atlas", label: en ? "Browse the archive by phenomenon in the Atlas →" : "Navegar o arquivo por fenômeno no Atlas →" };
}
// ★ Direção Editorial do Diário v1.0 (CONGELADA) — CSS das colunas permanentes. Escopado ao /diario (injetado como
//   'extra' do _chromeCss só aqui): não regride as outras páginas. Paleta base (marfim/serif) é a compartilhada.
const _DIARIO_CSS_V1 =
  ":root{--azul:#2c4a6e;--terra:#a85336;--oliva:#6b6a2e}" +
  ':root[data-theme="dark"]{--azul:#7aa6d6;--terra:#d68a6e;--oliva:#b6b46e}' +
  ".regime-rule{height:3px;border:0;margin:.9rem 0 1.4rem;background:repeating-linear-gradient(90deg,currentColor 0 16px,transparent 16px 24px)}" +   /* cicatrizes: segmentos na cor do regime (currentColor = regimeColor via style inline) */
  ".deck{font-family:var(--serif);font-size:19px;line-height:1.5;color:var(--txt2);max-width:54ch;margin:.2rem 0 1.5rem}" +
  ".sumario{margin:0 0 1.9rem}.sum-lb{font-family:var(--sans);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:.55rem}" +
  ".sumario ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:.35rem 1.5rem}.sumario li{font-family:var(--serif);font-size:15.5px}.sumario a{color:var(--txt);text-decoration:none}.sumario a:hover{color:var(--gold-ink)}.sumario .dot{font-size:8px;vertical-align:.2em;margin-right:.45rem}" +
  ".pulse-i{max-width:16rem;border-top:2px solid var(--line);padding-top:.7rem}.pulse-i.perene{border-top-color:var(--azul)}.pulse-i.anima{border-top-color:var(--terra)}.pulse-i.curto{border-top-color:var(--oliva)}" +
  ".pulse-id{font-family:var(--serif);font-size:13px;color:var(--dim);font-style:italic;margin:.12rem 0 .35rem;line-height:1.35}" +
  ".pulse-i.perene .pulse-nm{color:var(--azul)}.pulse-i.anima .pulse-nm{color:var(--terra)}.pulse-i.curto .pulse-nm{color:var(--oliva)}" +
  ".pulse-int{font-family:var(--serif);font-size:14px;color:var(--txt2);margin:.4rem 0 0;line-height:1.4}" +
  ".pulse-d{font-family:var(--sans);font-size:12px;color:var(--dim);margin-top:.3rem;letter-spacing:.02em}.pulse-d .arw{font-weight:600}.pulse-i.perene .arw{color:var(--azul)}.pulse-i.anima .arw{color:var(--terra)}.pulse-i.curto .arw{color:var(--oliva)}" +
  ".diverg{font-family:var(--serif);font-size:16px;color:var(--txt2);border-top:1px solid var(--line);margin:1.4rem 0 0;padding-top:1.1rem;max-width:60ch}" +
  ".pub{margin:2.2rem 0;border-top:1px solid var(--line);padding-top:.55rem}.pub-lb{display:block;font-family:var(--sans);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);opacity:.55;margin-bottom:.8rem}" +
  ".sec-lb{font-family:var(--sans);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);display:block;margin:2.2rem 0 .55rem}.sec-body{font-family:var(--serif);font-size:16.5px;line-height:1.7;color:var(--txt2);max-width:64ch}" +
  ".arquivo{margin:2.6rem 0;background:var(--surface2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 4px 4px 0;padding:1.3rem 1.4rem}" +
  ".arq-h{font-family:var(--sans);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:0 0 .1rem}.arq-mk{color:var(--gold-ink);font-size:14px}" +
  ".arq-intro{font-family:var(--serif);font-size:18px;line-height:1.5;color:var(--txt);max-width:56ch;margin:.35rem 0 1.3rem}.arq-intro b{font-weight:600}" +
  ".arq-tl{list-style:none;padding:0;margin:0}.arq-no{margin:0 0 1.1rem;padding:0}.arq-feat{margin-bottom:1.4rem;padding-bottom:1.2rem;border-bottom:1px solid var(--line)}" +
  ".arq-top{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.35rem;flex-wrap:wrap}.arq-sym{color:var(--gold-ink);font-size:11px}.arq-sym.o{color:var(--dim)}.arq-quando{font-family:var(--sans);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-ink)}.arq-quando.o{color:var(--dim)}.arq-data{font-family:var(--sans);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--dim)}" +
  ".arq-lin{display:flex;align-items:baseline;gap:.5rem;font-size:14.5px;color:var(--txt2);margin:.28rem 0}.arq-lin .dl{flex:1;border-bottom:1px dotted var(--line);transform:translateY(-.22em);min-width:1.5rem}.arq-v{font-variant-numeric:tabular-nums;color:var(--txt);white-space:nowrap}.arq-v em{color:var(--dim);font-style:italic;font-size:12.5px}" +
  ".arq-pct{color:var(--txt);font-weight:600}.arq-pct.up{color:var(--terra)}" +
  ".arq-oneline{font-size:14.5px;color:var(--txt2);font-variant-numeric:tabular-nums;line-height:1.5}.arq-oneline a{color:var(--gold-ink);text-decoration:none}.arq-oneline a:hover{text-decoration:underline}" +
  ".arq-reler{display:inline-block;margin-top:.55rem;font-size:13.5px;color:var(--gold-ink);text-decoration:none}.arq-reler:hover{text-decoration:underline}" +
  ".arq-foot{font-size:13px;color:var(--dim);margin:1.2rem 0 0;line-height:1.6;max-width:60ch}.arq-foot b{color:var(--txt2)}.arq-foot em{font-style:italic}.arq-foot a{color:var(--gold-ink);text-decoration:none}.arq-foot a:hover{text-decoration:underline}" +
  ".voz{margin:.4rem 0 0}.cas{background:none;border:0;border-radius:0;padding:0}.cas>b{display:none}.cas ul{list-style:none;padding:0;margin:.3rem 0 0}.cas .casm{margin-top:.5rem}" +
  ".colofon{font-family:var(--sans);font-size:12px;color:var(--dim);margin-top:1.6rem;letter-spacing:.02em}.colofon .reg{color:var(--txt2)}" +
  ".dt{font-family:var(--sans);text-transform:uppercase;letter-spacing:.08em;font-size:11.5px;color:var(--dim)}.dt b{color:var(--txt2);font-weight:600}" +
  ".sumario .sum-gate{font-style:italic;color:var(--dim)}.sumario .sum-gate a{color:var(--dim);text-decoration:none}.sumario .sum-gate a:hover{color:var(--gold-ink)}"
  + ".estados{margin:2.4rem 0;border-left:3px solid var(--gold);padding:.2rem 0 .2rem 1.2rem}"
  + ".es-h{font-family:var(--sans);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:0 0 .3rem}"
  + ".es-intro{font-family:var(--serif);font-size:16px;line-height:1.5;color:var(--txt2);max-width:58ch;margin:0 0 .9rem}"
  + ".es-list{list-style:none;padding:0;margin:0;display:grid;gap:.15rem}"
  + ".es-list li{border-bottom:1px dotted var(--line)}.es-list a{display:flex;flex-wrap:wrap;align-items:baseline;gap:.2rem .8rem;padding:.5rem 0;text-decoration:none;color:var(--txt)}.es-list a:hover .es-dt{color:var(--gold-ink)}"
  + ".es-dt{font-family:var(--serif);font-size:15px;color:var(--txt)}.es-p{font-family:var(--sans);font-size:12.5px;color:var(--dim);font-variant-numeric:tabular-nums}.es-reg{font-family:var(--sans);font-size:12px;color:var(--dim)}"
  + ".atlas-fen{display:inline-block;margin:.2rem 0 0;font-size:13.5px;color:var(--gold-ink);text-decoration:none}.atlas-fen:hover{text-decoration:underline}"
  + ".cnav-mid{font-size:12.5px;color:var(--dim)}.cnav-mid a{color:var(--gold-ink);text-decoration:none;margin:0 .4rem}.cnav-mid a:hover{text-decoration:underline}";
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
  // ★ v1.0: cada índice é um PERSONAGEM — nome + identidade de 1 linha + COR própria (Perene=azul, Ânima estrutural=
  //   terracota, curto=oliva) + movimento sutil ▴/▾/→ com delta "Hoje +N" (Perene/Ânima têm série diária no SNAPS).
  //   Número grande fica em --txt (calma=autoridade); só a marca de direção e o nome levam a cor. Zero gauge/barra.
  // movimento: ▲/▾/→ (filled) + delta; nos extremos, "NO TETO"/"NO PISO" em vez do número
  const _mov = (n, dv) => {
    if (n >= 100) return "<span class=\"arw\">→</span> <b>" + (en ? "AT THE TOP" : "NO TETO") + "</b>";
    if (n <= 0) return "<span class=\"arw\">→</span> <b>" + (en ? "AT THE FLOOR" : "NO PISO") + "</b>";
    if (dv == null) return "";
    return "<span class=\"arw\">" + (dv > 0 ? "▲" : dv < 0 ? "▾" : "→") + "</span> " + (dv > 0 ? "+" : "") + dv;
  };
  const _pItem = (nm, ident, n, cls, dv) => {
    if (n == null) return "";
    const mv = _mov(n, dv);
    return "<div class=\"pulse-i " + cls + "\"><span class=\"pulse-nm\">" + nm + "</span><span class=\"pulse-id\">" + ident + "</span>" +
      "<span class=\"pulse-n\">" + n + "<span class=\"pulse-u\">/100</span></span>" +
      (mv ? "<span class=\"pulse-d\">" + (en ? "Today " : "Hoje ") + mv + "</span>" : "") + "</div>";
  };
  const _pItems =
    _pItem(en ? "Perene Risk Index" : "Índice de Risco Perene", en ? "the market’s structural state" : "o estado estrutural do mercado", _pP, "perene", (nav.dPerene != null ? nav.dPerene : null)) +
    _pItem(en ? "Ânima · structural" : "Índice Ânima · estrutural", en ? "investors’ prevailing mood" : "o humor predominante dos investidores", _pA, "anima", (nav.dAnima != null ? nav.dAnima : null)) +
    _pItem(en ? "Ânima · short-term" : "Ânima · curto prazo", en ? "the market’s recent move" : "o movimento recente do mercado", _pAc, "curto", (nav.dCurto != null ? nav.dCurto : null));
  const mancheteHtml = _pItems ? "<section class=\"pulse\" id=\"pulso\"><div class=\"pulse-eyb\">" + (en ? "The Pulse" : "O Pulso") + "</div><div class=\"pulse-g\">" + _pItems + "</div><a class=\"pulse-help\" href=\"" + (en ? "/how-to-read-the-radar/" : "/como-ler-o-radar/") + "\">" + (en ? "how to read?" : "como interpretar?") + "</a></section>" : "";
  // chamada de divergência (com respiro) — determinística, do próprio snapshot: a tensão mais saliente do dia.
  let divergHtml = "";
  if (_pA != null && _pAc != null && Math.abs(_pA - _pAc) >= 20) {
    divergHtml = en
      ? "Structural mood (Ânima " + _pA + ") and recent move (" + _pAc + ") diverge."
      : "Humor estrutural (Ânima " + _pA + ") e movimento recente (" + _pAc + ") divergem.";
  } else if (_pP != null && _rl && /defens/i.test(_rl) && _pP >= 70) {
    divergHtml = en
      ? "The Perene Risk Index is stretched (" + _pP + ") while the month regime still reads defensive."
      : "O Índice de Risco Perene está esticado (" + _pP + ") enquanto o regime do mês ainda lê defensivo.";
  }
  divergHtml = divergHtml ? "<p class=\"diverg\">" + _esc(divergHtml) + "</p>" : "";
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
  // ── ★ Direção Editorial v1.0 (CONGELADA): colunas permanentes, ordem fixa, assinatura de regime. Determinístico. ──
  const regimeToday = regime ? (regime.classificacao || "") : "";
  const regimeColor = _regimeColor(regime && (regime.classificacao || regime.leitura || ""));
  const fileteHtml = "<div class=\"regime-rule\" style=\"color:" + regimeColor + "\" aria-hidden=\"true\"></div>";
  // deck (subtítulo/standfirst). ★ EDITOR determinístico (dono 2026-07-06): quando o pipeline pré-computou a
  //   voz que RESPIRA (narr.composicao_editor.texto — gramática de microestruturas, reprodutível, P7-limpa),
  //   ELA é o deck do dia (texto inteiro). Senão, cai no resumo do ghostwriter (1ª frase limpa). PT-only:
  //   o edge só emite composicao_editor em PT (estado_textual é PT-only), então o EN segue no resumo intocado.
  let deckHtml = "";
  const _ceTxt = (narr.composicao_editor && narr.composicao_editor.texto) ? String(narr.composicao_editor.texto).trim() : "";
  if (_ceTxt) {
    deckHtml = "<p class=\"deck\">" + _esc(_ceTxt) + "</p>";
  } else if (narr.resumo) {
    const _rz = String(narr.resumo).replace(/<[^>]+>/g, "").trim();
    const _dot = _rz.indexOf(". ");                                   // deck = 1ª frase LIMPA (não o resumo inteiro)
    const _first = (_dot > 0 ? _rz.slice(0, _dot + 1) : _clampDesc(_rz, 200));
    const _mm = _pm ? String(_pm.manchete).replace(/<[^>]+>/g, "").trim() : "";
    if (_first && _first.slice(0, 30).toLowerCase() !== _mm.slice(0, 30).toLowerCase()) deckHtml = "<p class=\"deck\">" + _esc(_first) + "</p>";
  }
  // O Arquivo Lembra — timeline do MESMO regime (via nav.historico); degrada p/ os 2 links estáticos se sem dado
  const arquivoHtml = _arquivoLembraHtml(nav.historico, _pP, date, en, dpath, regimeColor, nav.recorrencia) || _lembraHtml(date, en);
  const arquivoIsTimeline = arquivoHtml.indexOf('class="arquivo"') >= 0;
  // Fase 3 — teia lateral (estados semelhantes) + porta do Atlas por fenômeno. regimeToday/regimeColor/_pP já em escopo.
  const estadosHtml = _estadosSemelhantesHtml(nav.historico, _pP, date, en, dpath, regimeColor);
  const _atlasFen = _atlasPorFenomeno(regimeToday, _pP, en);
  const atlasFenHtml = "<a class=\"atlas-fen\" href=\"" + _atlasFen.href + "\">" + _esc(_atlasFen.label) + "</a>";
  // O Que Costuma Vir Depois (casos análogos) + O Que Chamou Atenção Hoje (voz) — rótulos de coluna
  const costumaHtml = pfHtml ? "<section id=\"depois\"><span class=\"sec-lb\">" + (en ? "What Usually Comes Next" : "O Que Costuma Vir Depois") + "</span>" + pfHtml + "</section>" : "";
  const hojeHtml = vozHtml ? "<section id=\"hoje\"><span class=\"sec-lb\">" + (en ? "Today’s Read" : "O Que Chamou Atenção Hoje") + "</span>" + vozHtml + "</section>" : "";
  const proximaHtml = "<section id=\"proxima\"><span class=\"sec-lb\">" + (en ? "For the Next Edition" : "Para a Próxima Edição") + "</span><p class=\"sec-body\">" + (en
    ? "The next reading arrives on the next business day — the regime is monthly, and the daily pulse carries the change until month-end."
    : "A próxima leitura chega no próximo dia útil — o regime é mensal, e o pulso diário carrega a variação até o fecho do mês.") + "</p></section>";
  // Publicidade editorial revestindo os slots AdSense (INVARIANTE: os 2 slots FICAM; só ganham rótulo "Publicidade")
  const _pub = function (slot) { return slot ? "<div class=\"pub\"><span class=\"pub-lb\">" + (en ? "Advertisement" : "Publicidade") + "</span>" + slot + "</div>" : ""; };
  // Nesta edição (sumário) — ● na cor do regime; só as seções presentes
  const _sum = [];
  if (mancheteHtml) _sum.push(["#pulso", en ? "The Pulse" : "O Pulso"]);
  if (arquivoIsTimeline) _sum.push(["#arquivo", en ? "The Archive Remembers" : "O Arquivo Lembra"]);
  if (costumaHtml) _sum.push(["#depois", en ? "What Usually Comes Next" : "O Que Costuma Vir Depois"]);
  if (estadosHtml) _sum.push(["#semelhantes", en ? "Editions in a similar state" : "Edições em estado semelhante"]);
  if (hojeHtml) _sum.push(["#hoje", en ? "Today’s Read" : "O Que Chamou Atenção Hoje"]);
  _sum.push(["#proxima", en ? "For the Next Edition" : "Para a Próxima Edição"]);
  const sumarioHtml = _sum.length >= 3 ? "<nav class=\"sumario\" aria-label=\"" + (en ? "In this edition" : "Nesta edição") + "\"><span class=\"sum-lb\">" + (en ? "In this edition" : "Nesta edição") + "</span><ul>" + _sum.map(function (s) { return "<li><span class=\"dot\" style=\"color:" + regimeColor + "\">●</span> <a href=\"" + s[0] + "\">" + _esc(s[1]) + "</a></li>"; }).join("") + "<li class=\"sum-gate\"><em><a href=\"" + (en ? "/subscribe" : "/assine") + "\">" + (en ? "Full reading — subscribers" : "Leitura completa — assinantes") + "</a></em></li>" + "</ul></nav>" : "";
  // cólofon — "regime · há N dias" (persistência do regime); nav.regimeDias vem do dispatch (série SNAPS)
  const colofonHtml = regimeToday ? "<p class=\"colofon\"><span class=\"reg\">" + (en ? "Regime " : "Regime ") + _esc(regimeToday) + "</span>" + (nav.regimeDias != null && nav.regimeDias > 0 ? " · " + (en ? "for " + nav.regimeDias + " days" : "há " + nav.regimeDias + " dias") : "") + "</p>" : "";
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "Dataset", "name": title, "description": desc, "url": canon, "inLanguage": en ? "en" : "pt-BR", "datePublished": date, "dateModified": date, "isAccessibleForFree": true, "creator": { "@type": "Organization", "name": "Radar Perene", "url": origin + "/" } }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"icon\" href=\"/favicon.ico\" sizes=\"48x48\"><link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/favicon-32x32.png\"><link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/favicon-16x16.png\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-light.svg\" media=\"(prefers-color-scheme: light)\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-dark.svg\" media=\"(prefers-color-scheme: dark)\"><link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/apple-touch-icon.png\"><link rel=\"mask-icon\" href=\"/safari-pinned-tab.svg\" color=\"#131521\"><link rel=\"manifest\" href=\"/site.webmanifest\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + desc + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    (nav.prev ? "<link rel=\"prev\" href=\"" + origin + dpath + "/" + nav.prev + "\">" : "") +
    (nav.next ? "<link rel=\"next\" href=\"" + origin + dpath + "/" + nav.next + "\">" : "") +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/diario/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/daily/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/diario/" + date + "\">" +
    "<meta property=\"og:type\" content=\"article\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + desc + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    "<script type=\"application/ld+json\">" + JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [ { "@type": "ListItem", "position": 1, "name": en ? "Home" : "Início", "item": origin + "/" }, { "@type": "ListItem", "position": 2, "name": en ? "Daily archive" : "Arquivo diário", "item": origin + dpath }, { "@type": "ListItem", "position": 3, "name": date, "item": canon } ] }).replace(/</g, "\\u003c") + "</script>" +
    _chromeCss(".h1m{font-family:var(--serif);font-weight:500;font-size:clamp(23px,3.4vw,33px);line-height:1.3;max-width:32ch;letter-spacing:-.01em}.lembra{font-size:13px;color:var(--dim);margin-top:20px}.lembra a{color:var(--gold-ink);text-decoration:none}.lembra a:hover{text-decoration:underline}.lembra .lb{font-size:10px;letter-spacing:1.3px;text-transform:uppercase;color:var(--gold-ink);margin-right:8px}.ver{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem;margin:1.1rem 0}.ver b{color:var(--txt)}.ver ul{margin:.4rem 0 0}.pf{display:flex;flex-wrap:wrap;gap:14px;margin:1.1rem 0}.pf>div{flex:1 1 300px;margin:0}.cas{background:var(--surface2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem}.cas b{color:var(--txt)}.cas ul{margin:.4rem 0 0}.casl{margin:.45rem 0 .2rem;color:var(--txt2);font-size:14px}.casm{margin:.5rem 0 0;font-size:12px;color:var(--dim)}.ctx{font-size:13px;color:var(--dim);margin-top:20px}.cnav{font-size:13px;margin-top:8px;display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}.cnav a{color:var(--gold-ink);text-decoration:none}.cnav a:hover{text-decoration:underline}.pulse{margin:1rem 0 1.6rem;padding-bottom:1.2rem;border-bottom:1px solid var(--line)}.pulse-eyb{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:1rem}.pulse-g{display:flex;gap:2.6rem;flex-wrap:wrap}.pulse-i{display:flex;flex-direction:column;gap:.25rem}.pulse-nm{font-size:13px;color:var(--dim);font-weight:500;letter-spacing:.01em}.pulse-n{font-family:var(--serif);font-size:46px;line-height:1;color:var(--txt);font-weight:500;font-variant-numeric:tabular-nums}.pulse-u{font-size:15px;color:var(--dim);font-weight:400;margin-left:.15rem}.pulse-help{display:inline-block;margin-top:1.1rem;font-size:12px;color:var(--dim);text-decoration:none}.pulse-help:hover{color:var(--gold-ink);text-decoration:underline}@media(max-width:480px){.pulse-g{gap:1.9rem}.pulse-n{font-size:40px}}.voz{font-family:var(--serif);margin:1rem 0 1.5rem;max-width:64ch}.voz p{font-size:19px;line-height:1.65;color:var(--txt);margin:0 0 .65rem}.voz p.rp-sig{font-size:13px;color:var(--gold-ink);font-style:italic;margin:.15rem 0 1rem}.voz ul.rp-voz-bul{list-style:none;padding:0;margin:.2rem 0 0}.voz ul.rp-voz-bul li{font-family:var(--serif);font-size:15px;color:var(--txt2);padding:.2rem 0 .2rem 1.1rem;position:relative;line-height:1.5}.voz ul.rp-voz-bul li:before{content:'\\2022';color:var(--gold-ink);position:absolute;left:.1rem}.panh{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:1.3rem 0 .3rem}.mctx{background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:.7rem 1rem;margin:1rem 0}.mctx>b{font-size:13px;color:var(--dim);letter-spacing:.04em}.mctx ul{margin:.35rem 0 0;padding-left:1.1rem}.memo{margin:1.3rem 0}.memohd{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-ink);font-weight:600;margin-bottom:.5rem}.memobody{color:var(--txt2);font-size:16px;line-height:1.7;max-width:66ch}.memobody h1{font-family:var(--serif);font-weight:500;font-size:21px;color:var(--txt);margin:.4rem 0 .5rem}.memobody h2{font-family:var(--serif);font-weight:500;font-size:18px;color:var(--txt);margin:1.3rem 0 .4rem}.memobody h3{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--gold-ink);margin:1.2rem 0 .35rem}.memobody p{margin:0 0 .75rem}.memobody ul{margin:0 0 .75rem}.memobody hr{border:0;border-top:1px solid var(--line);margin:1.2rem 0}.memobody em{color:var(--dim)}.memobody .selo{display:block;font-size:12px;color:var(--dim);margin-top:.3rem}.memogate{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:1rem 1.1rem}.memogate .gh{font-family:var(--serif);font-size:18px;color:var(--txt);margin-bottom:.3rem}.memogate p{margin:0 0 .7rem;color:var(--dim);font-size:14px}.memogate .ghb{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.memogate .gl{color:var(--gold-ink);font-weight:600;text-decoration:none;font-size:14.5px}.memogate .gl:hover{text-decoration:underline}.memogate .lg{font-size:13px;color:var(--dim)}.wsamplebox{margin:1.3rem 0}.wsample{display:block;background:var(--surface2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem;text-decoration:none}.wsample:hover{border-color:var(--gold-ink)}.wsample .wt{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-ink);font-weight:600;margin-bottom:.25rem}.wsample .wd{display:block;color:var(--txt2);font-size:15px}.memotabs{display:flex;flex-wrap:wrap;gap:18px;margin:.2rem 0 1rem;border-bottom:1px solid var(--line)}.memotab{background:transparent;border:0;border-bottom:1.5px solid transparent;color:var(--txt2);padding:6px 2px 8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.memotab:hover{color:var(--gold-ink)}.memotab.on{background:transparent;color:var(--gold-ink);border-bottom-color:var(--gold-ink)}.memohd2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-ink);font-weight:600;margin-bottom:.5rem}.memografs{margin:1.1rem 0;display:grid;gap:12px}.memograf{width:100%;max-width:520px;border:1px solid var(--line);border-radius:8px;display:block}" + _DIARIO_CSS_V1) +
    "</head><body>" + _header(en) + "<div class=\"wrap\">" +
    (_pm ? '<h1 class="h1m">' + _pm.manchete + "</h1>" : "<h1>" + (en ? "Brazil market regime" : "Regime do mercado brasileiro") + "</h1>") +
    "<p class=\"dt\">" + (nav.num ? (en ? "Edition no. " : "Edição nº ") + nav.num + " · " : (en ? "Edition of " : "Edição de ")) + _dtEd + (regimeToday ? " · " + (en ? "Regime " : "Regime ") + _esc(regimeToday) : "") + (nav.regimeDias != null && nav.regimeDias > 0 ? " · <b>" + (en ? "for " + nav.regimeDias + " days" : "há " + nav.regimeDias + " dias") + "</b>" : "") + (snap.frozen === false ? " · " + (en ? "reconstructed essentials" : "essencial reconstruído") : "") + "</p>" +
    fileteHtml +
    deckHtml +
    sumarioHtml +
    mancheteHtml +
    divergHtml +
    _pub(inArticleSlot) +
    arquivoHtml +
    costumaHtml +
    estadosHtml +
    hojeHtml +
    _pub(multiplexSlot) +
    proximaHtml +
    _memoGate(date, WEEKLY_SAMPLE_DATES.indexOf(date) >= 0 ? date : (WEEKLY_SAMPLE_DATES[WEEKLY_SAMPLE_DATES.length - 1] || null)) +
    colofonHtml +
    "<p class=\"ctx\">" + (en ? "Concepts: " : "Conceitos: ") + "<a href=\"/conceitos/regime-brasil/\">" + (en ? "Brazil Regime" : "Regime Brasil") + "</a> · <a href=\"/conceitos/intermercado-br/\">" + (en ? "Intermarket BR" : "Intermercado BR") + "</a> · <a href=\"/conceitos/analogos-historicos/\">" + (en ? "Historical Analogs" : "Análogos Históricos") + "</a> · " + (en ? "How to read: " : "Como ler: ") + "<a href=\"/como-ler-o-radar/\">" + (en ? "six steps" : "seis passos") + "</a> · <a href=\"/metodologia/\">" + (en ? "Methodology" : "Metodologia") + "</a> · <a href=\"" + (en ? "/track-record" : "/historico") + "\">" + (en ? "Track record" : "Track record") + "</a> · " + (en ? "From the archive: " : "Do acervo: ") + "<a href=\"" + (en ? "/articles/" : "/artigos/") + "\">" + (en ? "essays & precedents" : "artigos e precedentes") + "</a>" + " · " + atlasFenHtml + "</p>" +
    "<p class=\"cnav\">" +
      (nav.prev ? "<a href=\"" + dpath + "/" + nav.prev + "\">← " + (en ? "previous edition · " : "edição anterior · ") + nav.prev + "</a>" : "<span></span>") +
      "<span class=\"cnav-mid\"><a href=\"" + dpath + "\">" + (en ? "all editions" : "todas as edições") + "</a> · <a href=\"/atlas\">Atlas</a></span>" +
      (nav.next ? "<a href=\"" + dpath + "/" + nav.next + "\">" + nav.next + " · " + (en ? "next edition" : "edição seguinte") + " →</a>" : "<span></span>") +
    "</p>" +
    "</div></main><footer><a href=\"" + dpath + "\">" + (en ? "← all daily readings" : "← todas as leituras diárias") + "</a> · <a href=\"/\">" + (en ? "full radar" : "radar completo") + "</a> · " + (en ? "Descriptive, not a forecast. Public sources." : "Descritivo, não previsão. Fontes públicas.") + "</footer>" +
    "<script src=\"/ads.js\" defer></script>" + _themeScript() + _CONSENT + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
// client-side do /atlas — paisagem SVG + gavetas + respira, localizado por window.ATLAS.en, links p/ edições (fim-de-mês)
const _ATLAS_JS = '<script>(function(){' +
'var A=window.ATLAS||{};var EN=!!A.en,DP=A.dpath||"/diario";' +
'var L=function(pt,en){return EN?en:pt;};' +
'var fmt=function(n){return Number(n).toLocaleString(EN?"en-US":"pt-BR");};' +
'var css=function(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim();};' +
'var REGpt={risk_on:"risco ligado",risk_on_amplo:"risco ligado amplo",neutro:"neutro",defensivo:"defensivo"};' +
'var REGen={risk_on:"risk-on",risk_on_amplo:"broad risk-on",neutro:"neutral",defensivo:"defensive"};' +
'var REG=function(k){return (EN?REGen:REGpt)[k]||k;};' +
'var RCOL={risk_on:"var(--terra)",risk_on_amplo:"var(--terra)",neutro:"var(--oliva)",defensivo:"var(--slate)"};' +
'var MES=EN?["January","February","March","April","May","June","July","August","September","October","November","December"]:["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];' +
'function ym(i){var y=2000+Math.floor(i/12),m=i%12;return{y:y,m:m,label:MES[m]+(EN?" ":" de ")+y};}' +
'function edLink(y,m){var d=new Date(y,m+1,0);var mm=("0"+(m+1)).slice(-2),dd=("0"+d.getDate()).slice(-2);return DP+"/"+y+"-"+mm+"-"+dd;}' +
// ---- respira ----
'var respira=EN?[' +
'{t:"A year ago, the market entered this same <b>defensive regime</b>. What followed: the Ibovespa rose <b>+36%</b> in six months.",d:"July 2025",y:2025,m:6},' +
'{t:"In March 2020, the Perene Risk Index touched <b>5.7</b> — the floor of the whole archive. In the six months that followed, the market’s mood doubled.",d:"March 2020",y:2020,m:2},' +
'{t:"November 2016 marked <b>8.3</b>: the second-deepest capitulation on record. The regime had read defensive for three months.",d:"November 2016",y:2016,m:10},' +
'{t:"For <b>35 straight months</b> — 2010 to 2013 — the archive read risk-on without a break. The longest regime in the whole collection.",d:"June 2010",y:2010,m:5}' +
']:[' +
'{t:"Há um ano, o mercado entrou neste mesmo <b>regime defensivo</b>. O que se seguiu: o Ibovespa fez <b>+36%</b> em seis meses.",d:"julho de 2025",y:2025,m:6},' +
'{t:"Em março de 2020, o Índice de Risco Perene tocou <b>5,7</b> — o fundo de todo o arquivo. Nos seis meses seguintes, o mercado dobrou de humor.",d:"março de 2020",y:2020,m:2},' +
'{t:"Novembro de 2016 marcou <b>8,3</b>: a segunda maior capitulação já registrada. O regime já lia defensivo havia três meses.",d:"novembro de 2016",y:2016,m:10},' +
'{t:"Por <b>35 meses seguidos</b> — de 2010 a 2013 — o arquivo leu risco ligado sem interrupção. O regime mais longo de todo o acervo.",d:"junho de 2010",y:2010,m:5}' +
'];' +
'var ri=0,dots=document.getElementById("r-dots");respira.forEach(function(){var i=document.createElement("i");dots.appendChild(i);});' +
'function showR(){var r=respira[ri];document.getElementById("r-body").innerHTML=r.t;var c=document.getElementById("r-cta");c.textContent=L("Reler a edição de "+r.d+" →","Reread the "+r.d+" edition →");c.href=edLink(r.y,r.m);var ds=dots.children;for(var i=0;i<ds.length;i++)ds[i].className=i===ri?"on":"";}' +
'showR();var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;if(!reduce)setInterval(function(){ri=(ri+1)%respira.length;showR();},6500);' +
// ---- gavetas ----
'var dist=A.dist||{},ult=A.ultimas||[];' +
'var drawersData=[' +
'{k:L("Por regime","By regime"),h:L("como cada regime se resolveu","how each regime resolved"),r:function(){' +
'var ord=["defensivo","neutro","risk_on","risk_on_amplo"];var chips=ord.map(function(x){return "<button class=\\"qchip\\">"+REG(x)+"<span class=\\"n\\">"+(dist[x]||0)+L(" meses"," mo")+"</span></button>";}).join("");' +
'return "<div class=\\"qrow\\">"+chips+"</div><ul class=\\"plist\\"><li><span class=\\"sym re\\">◐</span><span class=\\"yr\\">"+L("35 meses","35 mo")+"</span><span class=\\"desc\\">"+L("o regime mais longo: risco ligado, de jun/2010 a mai/2013","the longest regime: risk-on, Jun 2010 to May 2013")+"</span><span class=\\"val\\">"+L("média 55","avg 55")+"</span></li><li><span class=\\"sym ex\\">●</span><span class=\\"yr\\">"+L("18 meses","18 mo")+"</span><span class=\\"desc\\">"+L("defensivo contínuo, de mai/2024 em diante","continuous defensive, from May 2024")+"</span><span class=\\"val\\">"+L("o atual","current")+"</span></li><li><span class=\\"sym fi\\">○</span><span class=\\"yr\\">jun/2014</span><span class=\\"desc\\">"+L("primeira vez que o arquivo leu defensivo","first time the archive read defensive")+"</span><span class=\\"val\\"><a href=\\""+edLink(2014,5)+"\\">"+L("reler →","reread →")+"</a></span></li></ul>";}},' +
'{k:L("Por extremo","By extreme"),h:L("euforia e capitulação","euphoria and capitulation"),r:function(){' +
'return "<div class=\\"qrow\\"><button class=\\"qchip\\">"+L("Perene ≥ 90","Perene ≥ 90")+"<span class=\\"n\\">"+fmt(A.ge90)+L(" dias"," days")+"</span></button><button class=\\"qchip\\">Perene ≤ 10<span class=\\"n\\">"+fmt(A.le10)+L(" dias"," days")+"</span></button></div><ul class=\\"plist\\"><li><span class=\\"sym ex\\">●</span><span class=\\"yr\\">"+L("mar/2020","Mar 2020")+"</span><span class=\\"desc\\">"+L("o fundo de todo o arquivo — pânico da pandemia","the floor of the whole archive — pandemic panic")+"</span><span class=\\"val\\"><a href=\\""+edLink(2020,2)+"\\">"+L("Perene 5,7 · reler →","Perene 5.7 · reread →")+"</a></span></li><li><span class=\\"sym ex\\">●</span><span class=\\"yr\\">"+L("nov/2016","Nov 2016")+"</span><span class=\\"desc\\">"+L("capitulação — a economia em recessão","capitulation — the economy in recession")+"</span><span class=\\"val\\"><a href=\\""+edLink(2016,10)+"\\">"+L("Perene 8,3 · reler →","Perene 8.3 · reread →")+"</a></span></li></ul>";}},' +
'{k:L("Por virada","By turn"),h:L("as mudanças de ciclo","the cycle changes"),r:function(){' +
'var rows=ult.slice().reverse().map(function(v){var p=v.quando.split("-");return "<li><span class=\\"sym re\\">◐</span><span class=\\"yr\\">"+p[1]+"/"+p[0]+"</span><span class=\\"desc\\">"+REG(v.de)+" <span style=\\"color:var(--dim)\\">→</span> "+REG(v.para)+"</span><span class=\\"val\\"><a href=\\""+edLink(+p[0],+p[1]-1)+"\\">"+L("reler →","reread →")+"</a></span></li>";}).join("");' +
'return "<div class=\\"qrow\\"><button class=\\"qchip\\">"+L("Total de viradas","Total turns")+"<span class=\\"n\\">"+A.viradas+"</span></button></div><ul class=\\"plist\\">"+rows+"</ul>";}},' +
'{k:L("Por crise","By crisis"),h:L("a história por acontecimento","history by event"),r:function(){' +
'return "<ul class=\\"plist\\"><li><span class=\\"sym ex\\">●</span><span class=\\"yr\\">2008</span><span class=\\"desc\\">"+L("Crise do subprime — o Perene despencou de 82 a 16","Subprime crisis — Perene plunged from 82 to 16")+"</span><span class=\\"val\\"><a href=\\""+edLink(2008,9)+"\\">"+L("out","Oct")+" →</a></span></li><li><span class=\\"sym ex\\">●</span><span class=\\"yr\\">2015–16</span><span class=\\"desc\\">"+L("Recessão e impeachment de Dilma","Recession and Dilma’s impeachment")+"</span><span class=\\"val\\"><a href=\\""+edLink(2016,3)+"\\">"+L("reler →","reread →")+"</a></span></li><li><span class=\\"sym ex\\">●</span><span class=\\"yr\\">mai/2017</span><span class=\\"desc\\">"+L("Joesley Day — o choque de um dia","Joesley Day — the one-day shock")+"</span><span class=\\"val\\"><a href=\\""+edLink(2017,4)+"\\">"+L("reler →","reread →")+"</a></span></li><li><span class=\\"sym ex\\">●</span><span class=\\"yr\\">mar/2020</span><span class=\\"desc\\">"+L("Pandemia — o fundo do arquivo","Pandemic — the archive’s floor")+"</span><span class=\\"val\\"><a href=\\""+edLink(2020,2)+"\\">"+L("reler →","reread →")+"</a></span></li></ul>";}},' +
'{k:L("Por ano","By year"),h:"2000 – 2026",r:function(){return "<p style=\\"font-size:14px;color:var(--dim);font-style:italic;margin:0\\">"+L("A grade completa dos 27 anos está logo abaixo, em \\u201CExplorar por período\\u201D — cada ano abre um capítulo.","The full 27-year grid is right below, in \\u201CExplore by period\\u201D — each year opens a chapter.")+"</p>";}},' +
'{k:L("Pesquisar","Search"),h:L("por índice, valor ou data","by index, value or date"),r:function(){return "<div class=\\"qrow\\"><button class=\\"qchip\\">"+L("\\u201Cquando o Perene passou de 95\\u201D","\\u201Cwhen the Perene passed 95\\u201D")+"</button><button class=\\"qchip\\">"+L("\\u201Cregime defensivo mais longo\\u201D","\\u201Clongest defensive regime\\u201D")+"</button><button class=\\"qchip\\">"+L("\\u201Cmarço de 2020\\u201D","\\u201CMarch 2020\\u201D")+"</button></div><p style=\\"font-size:14px;color:var(--dim);font-style:italic;margin:0\\">"+L("A busca do acervo: pergunte em linguagem natural; a data vem como resposta. (Em breve.)","The archive search: ask in natural language; the date comes as the answer. (Soon.)")+"</p>";}}' +
'];' +
'var dc=document.getElementById("drawers");' +
'drawersData.forEach(function(d,i){var el=document.createElement("div");el.className="drawer";' +
'el.innerHTML="<button type=\\"button\\"><span class=\\"idx\\">"+("0"+(i+1)).slice(-2)+"</span><span class=\\"dt\\">"+d.k+"</span><span class=\\"hint\\">"+d.h+"</span><span class=\\"chev\\">\\u203A</span></button><div class=\\"panel\\"><div class=\\"panel-in\\">"+d.r()+"</div></div>";' +
'el.querySelector("button").onclick=function(){var was=el.classList.contains("open");Array.prototype.forEach.call(dc.children,function(c){c.classList.remove("open");});if(!was)el.classList.add("open");};dc.appendChild(el);});' +
// ---- casos clássicos ----
'var CLASS=EN?[["Subprime crisis","2008"],["Recession","2015"],["Impeachment","2016"],["Joesley Day","2017"],["Truckers’ strike","2018"],["Elections","2018"],["Pandemic","2020"],["Monetary tightening","2022"]]:[["Crise do subprime","2008"],["Recessão","2015"],["Impeachment","2016"],["Joesley Day","2017"],["Greve dos caminhoneiros","2018"],["Eleições","2018"],["Pandemia","2020"],["Aperto monetário","2022"]];' +
'document.getElementById("classics").innerHTML=CLASS.map(function(c){return "<span>"+c[0]+"<span class=\\"m\\">"+c[1]+"</span></span>";}).join("");' +
// ---- anos ----
'var yl=document.getElementById("years");(A.years||[]).forEach(function(y){var reg=y.mean>=60?"risk_on":(y.mean<=48?"defensivo":"neutro");var el=document.createElement("a");el.className="yr-cell";el.href=edLink(+y.y,11);el.innerHTML="<div class=\\"y\\">"+y.y+"</div><div class=\\"m\\">"+y.n+L(" leituras · Perene médio "," readings · avg Perene ")+Math.round(y.mean)+"</div><div class=\\"bar\\" style=\\"background:"+RCOL[reg]+";opacity:.55;width:"+Math.round(y.mean)+"%\\"></div>";yl.appendChild(el);});' +
// ---- comece por aqui ----
'var ENTR=EN?[["First edition","31 Jan 2000",2000,0],["Greatest euphoria","Perene 100",2019,0],["Greatest capitulation","Mar 2020 · 5.7",2020,2],["Longest regime","35 mo · 2010",2010,5],["Last turn","Dec 2025",2025,11],["The full archive","6,566 →",-1,-1]]:[["Primeira edição","31 jan 2000",2000,0],["Maior euforia","Perene 100",2019,0],["Maior capitulação","mar 2020 · 5,7",2020,2],["Regime mais longo","35 meses · 2010",2010,5],["Última virada","dez 2025",2025,11],["O acervo completo","6.566 →",-1,-1]];' +
'document.getElementById("entries").innerHTML=ENTR.map(function(e){var href=e[2]<0?DP:edLink(e[2],e[3]);return "<a class=\\"entry\\" href=\\""+href+"\\"><div class=\\"e-k\\">"+e[0]+"</div><div class=\\"e-v\\">"+e[1]+"</div></a>";}).join("");' +
// ---- paisagem (SVG relief) ----
'var pais=document.getElementById("pais"),tip=document.getElementById("tip");' +
'function paint(){var W=1080,H=300,pad=6,base=H-34;var P=A.P||[],n=P.length;if(!n)return;var step=(W-pad*2)/(n-1);' +
'var x=function(i){return pad+i*step;},yy=function(v){return pad+(1-v/100)*(base-pad);};' +
'var d="M"+x(0)+" "+yy(P[0]);for(var i=1;i<n;i++)d+=" L"+x(i).toFixed(1)+" "+yy(P[i]).toFixed(1);' +
'var area=d+" L"+x(n-1)+" "+base+" L"+x(0)+" "+base+" Z";' +
'var RCr={risk_on:css("--terra"),risk_on_amplo:css("--terra"),neutro:css("--oliva"),defensivo:css("--slate")};' +
'var bandY=base+6,bandH=10,bands="";for(var b=0;b<(A.bands||[]).length;b++){var i0=A.bands[b][0],lab=A.bands[b][1],i1=(b+1<A.bands.length?A.bands[b+1][0]:n);if(!lab)continue;bands+="<rect x=\\""+x(i0).toFixed(1)+"\\" y=\\""+bandY+"\\" width=\\""+((i1-i0)*step).toFixed(1)+"\\" height=\\""+bandH+"\\" fill=\\""+RCr[lab]+"\\" opacity=\\"0.5\\"/>";}' +
'var ticks="";[0,60,120,180,240,300].forEach(function(i){if(i>=n)return;ticks+="<text x=\\""+x(i).toFixed(1)+"\\" y=\\""+(H-4)+"\\" fill=\\""+css("--dim")+"\\" font-size=\\"10\\" text-anchor=\\"middle\\">"+(2000+Math.floor(i/12))+"</text>";});' +
'var cr=[[104,L("Subprime","Subprime")],[202,L("Recessão","Recession")],[242,"COVID"]],cm="";cr.forEach(function(c){if(c[0]>=n)return;var xi=x(c[0]);cm+="<line x1=\\""+xi.toFixed(1)+"\\" y1=\\""+yy(P[c[0]]).toFixed(1)+"\\" x2=\\""+xi.toFixed(1)+"\\" y2=\\""+(base-2)+"\\" stroke=\\""+css("--terra")+"\\" stroke-width=\\"1\\" stroke-dasharray=\\"2 2\\" opacity=\\"0.6\\"/><text x=\\""+xi.toFixed(1)+"\\" y=\\""+(yy(P[c[0]])-6).toFixed(1)+"\\" fill=\\""+css("--terra")+"\\" font-size=\\"10.5\\" text-anchor=\\"middle\\">"+c[1]+"</text>";});' +
'var mid=yy(50);var old=pais.querySelector("svg");if(old)old.remove();' +
'var svg="<svg viewBox=\\"0 0 "+W+" "+H+"\\" role=\\"img\\" aria-label=\\""+L("Índice de Risco Perene, 2000 a 2026","Perene Risk Index, 2000 to 2026")+"\\"><defs><linearGradient id=\\"pg\\" x1=\\"0\\" y1=\\"0\\" x2=\\"0\\" y2=\\"1\\"><stop offset=\\"0\\" stop-color=\\""+css("--gold")+"\\" stop-opacity=\\"0.22\\"/><stop offset=\\"1\\" stop-color=\\""+css("--gold")+"\\" stop-opacity=\\"0.02\\"/></linearGradient></defs><line x1=\\""+pad+"\\" y1=\\""+mid+"\\" x2=\\""+(W-pad)+"\\" y2=\\""+mid+"\\" stroke=\\""+css("--line")+"\\" stroke-width=\\"1\\" stroke-dasharray=\\"3 4\\"/><path d=\\""+area+"\\" fill=\\"url(#pg)\\"/><path d=\\""+d+"\\" fill=\\"none\\" stroke=\\""+css("--gold")+"\\" stroke-width=\\"1.4\\" stroke-linejoin=\\"round\\"/>"+bands+cm+ticks+"</svg>";' +
'pais.insertAdjacentHTML("beforeend",svg);var s=pais.querySelector("svg");' +
'function at(e){var r=s.getBoundingClientRect();return Math.max(0,Math.min(n-1,Math.round((e.clientX-r.left)/r.width*(n-1))));}' +
's.style.cursor="pointer";' +
's.addEventListener("mousemove",function(e){var i=at(e),t=ym(i),r=s.getBoundingClientRect();tip.innerHTML=t.label+" · Perene <b>"+Math.round(P[i])+"</b>";tip.style.left=(i/(n-1)*100)+"%";tip.style.top=(yy(P[i])/H*r.height)+"px";tip.style.opacity="1";});' +
's.addEventListener("mouseleave",function(){tip.style.opacity="0";});' +
's.addEventListener("click",function(e){var i=at(e),t=ym(i);location.href=edLink(t.y,t.m);});}' +
'paint();' +
'})();<\/script>';
// ── /atlas — Atlas do Mercado Brasileiro: a /diario "index" reimaginada como INSTRUMENTO de pesquisa (navegação
//    por fenômeno, não por data). Consome /v1/atlas (agregação do acervo). Determinístico, público, citável.
//    O /diario cronológico continua existindo (crawl/SEO das edições). Editorial: marfim/serifa/ouro + azul/terra/oliva.
function _renderAtlas(atlas, origin, lang) {
  const en = lang === "en";
  const A = atlas || {};
  const dpath = en ? "/daily" : "/diario";
  // Fase 3 — links recíprocos crawláveis Atlas→edições de virada (server-rendered, não só via JS). Guarda de data futura.
  const _today = new Date().toISOString().slice(0, 10);
  const _ult = (A.ultimas || []);
  const _edLast = _ult.slice().reverse().map(function (v) {
    const p = String(v.quando).split("-"); if (p.length < 2) return "";
    const y = +p[0], m = +p[1];                 // m = mês da virada (1-based)
    const dd = new Date(y, m, 0);               // fim do mês m (consistente c/ edLink do client)
    const iso = y + "-" + ("0" + m).slice(-2) + "-" + ("0" + dd.getDate()).slice(-2);
    if (iso > _today) return "";                // nunca linkar edição de data futura (inexistente)
    return "<a href=\"" + dpath + "/" + iso + "\">" + iso + "</a>";
  }).filter(Boolean).join(" · ");
  const canon = origin + "/atlas";
  const total = A.total || 0;
  const anos = A.years ? A.years.length : 0;
  const title = (en ? "Atlas of the Brazilian Market" : "Atlas do Mercado Brasileiro") + " — Radar Perene";
  const desc = en
    ? "Radar Perene's public, citable archive of the Brazilian market — " + total + " daily readings since 2000, navigable by phenomenon: regimes, extremes, cycle turns, crises. Descriptive, never a forecast."
    : "O arquivo público e citável do Radar Perene sobre o mercado brasileiro — " + total + " leituras diárias desde 2000, navegável por fenômeno: regimes, extremos, viradas, crises. Descritivo, nunca previsão.";
  // dados + flags para o cliente (paisagem/gavetas/respira). Localização e link de edição vão embutidos.
  const client = { start: A.start, P: A.P || [], bands: A.bands || [], years: A.years || [], total: total,
    ge90: A.ge90 || 0, le10: A.le10 || 0, viradas: A.viradas || 0, dist: A.dist || {}, ultimas: A.ultimas || [],
    en: en, dpath: dpath };
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "description": desc, "url": canon, "inLanguage": en ? "en" : "pt-BR", "isAccessibleForFree": true, "creator": { "@type": "Organization", "name": "Radar Perene", "url": origin + "/" } }).replace(/</g, "\\u003c");
  const CSS =
    ':root{--azul:#2c4a6e;--terra:#a85336;--oliva:#6b6a2e;--slate:#5b6b7a}' +
    ':root[data-theme="dark"]{--azul:#7aa6d6;--terra:#d68a6e;--oliva:#b6b46e;--slate:#8a98a8}' +
    '.atlas{max-width:1080px;margin:0 auto;padding:0 6px}' +
    '.eyb{font-family:var(--sans);font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}' +
    '.a-hero{padding:22px 0 8px}.a-hero .eyb{display:block;margin-bottom:14px}.a-hero h1{font-family:var(--serif);font-weight:500;font-size:clamp(34px,6vw,62px);line-height:1.03;letter-spacing:-.018em;color:var(--txt);max-width:16ch;margin:0}' +
    '.a-hero .sub{font-family:var(--serif);font-size:clamp(16px,2vw,20px);color:var(--txt2);font-style:italic;margin:14px 0 0;max-width:46ch}' +
    '.thesis{font-family:var(--serif);font-size:clamp(18px,2.4vw,24px);line-height:1.4;color:var(--txt);max-width:30ch;margin:26px 0 0}.thesis b{color:var(--gold-ink);font-weight:500}' +
    '.a-stats{font-family:var(--sans);font-size:13px;color:var(--dim);margin:18px 0 0;display:flex;flex-wrap:wrap;align-items:center}.a-stats span{white-space:nowrap}.a-stats .sep{margin:0 11px;color:var(--line)}.a-stats b{color:var(--txt2);font-weight:600}' +
    '.a-rule{height:1px;background:var(--line);border:0;margin:38px 0}' +
    '.a-sec{padding:4px 0}.a-sec h2{font-family:var(--serif);font-weight:500;font-size:clamp(21px,3vw,28px);letter-spacing:-.01em;color:var(--txt);margin:0}.a-lead{font-family:var(--serif);font-size:15.5px;color:var(--dim);font-style:italic;max-width:56ch;margin:.3rem 0 1.5rem}' +
    '.respira{border-top:2px solid var(--gold);padding:16px 0 4px}.respira .lb{font-family:var(--sans);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-ink);display:flex;align-items:center;gap:8px}.respira .body{font-family:var(--serif);font-size:clamp(19px,2.6vw,25px);line-height:1.4;color:var(--txt);max-width:34ch;margin:13px 0 6px}.respira .body b{color:var(--terra);font-weight:500}.respira .cta{font-family:var(--sans);font-size:13.5px}.respira .cta a{color:var(--gold-ink)}.respira .dots{display:inline-flex;gap:5px}.respira .dots i{width:5px;height:5px;border-radius:50%;background:var(--line);display:inline-block;transition:background .3s}.respira .dots i.on{background:var(--gold)}' +
    '.drawers{border-top:1px solid var(--line)}.drawer{border-bottom:1px solid var(--line)}.drawer>button{width:100%;display:flex;align-items:center;gap:16px;background:none;border:0;cursor:pointer;padding:17px 2px;text-align:left;font-family:inherit;color:var(--txt)}.drawer .idx{font-family:var(--mono);font-size:12px;color:var(--dim);width:26px;flex:none}.drawer .dt{font-family:var(--serif);font-size:clamp(18px,2.3vw,23px);flex:1;color:var(--txt)}.drawer .hint{font-family:var(--sans);font-size:12.5px;color:var(--dim);display:none}@media(min-width:720px){.drawer .hint{display:block}}.drawer .chev{font-family:var(--sans);color:var(--dim);font-size:16px;transition:transform .25s;flex:none}.drawer.open .chev{transform:rotate(90deg);color:var(--gold-ink)}.drawer .panel{overflow:hidden;max-height:0;transition:max-height .35s ease}.drawer.open .panel{max-height:900px}.drawer .panel-in{padding:2px 2px 24px 44px}@media(max-width:520px){.drawer .panel-in{padding-left:2px}}' +
    '.qrow{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 16px}.qchip{font-family:var(--sans);font-size:13px;color:var(--txt2);border:1px solid var(--line);border-radius:2px;padding:7px 13px;background:var(--bg)}.qchip .n{font-family:var(--mono);color:var(--dim);margin-left:7px}' +
    '.plist{list-style:none;padding:0;margin:0}.plist li{display:flex;align-items:baseline;gap:12px;padding:8px 0;border-bottom:1px dotted var(--line);font-size:14.5px}.plist .sym{font-size:11px;flex:none;width:14px}.plist .sym.ex{color:var(--terra)}.plist .sym.re{color:var(--gold-ink)}.plist .sym.fi{color:var(--dim)}.plist .yr{font-family:var(--mono);font-size:13px;color:var(--txt);width:84px;flex:none}.plist .desc{color:var(--txt2);flex:1}.plist .val{font-family:var(--mono);color:var(--dim);white-space:nowrap}.plist a{color:var(--gold-ink)}' +
    '.paisagem{margin:6px 0 0}.pais-scale{display:flex;justify-content:space-between;font-family:var(--sans);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin-bottom:8px}.pais-box{position:relative;width:100%;overflow:hidden}.pais-box svg{display:block;width:100%;height:auto}.pais-tip{position:absolute;pointer-events:none;background:var(--txt);color:var(--bg);font-family:var(--mono);font-size:11px;padding:5px 9px;border-radius:3px;opacity:0;transform:translate(-50%,-130%);transition:opacity .12s;white-space:nowrap;z-index:5}.pais-tip b{color:var(--gold)}.pais-legend{display:flex;flex-wrap:wrap;gap:6px 20px;font-family:var(--sans);font-size:11.5px;color:var(--dim);margin-top:12px}.pais-legend i{display:inline-block;width:11px;height:11px;border-radius:2px;vertical-align:-1px;margin-right:6px}.pais-legend .foot{width:100%;font-style:italic;margin-top:2px}' +
    '.cols{display:grid;grid-template-columns:1fr;border-top:1px solid var(--line)}@media(min-width:760px){.cols{grid-template-columns:1fr 1fr}}.col{padding:22px 0;border-bottom:1px solid var(--line)}@media(min-width:760px){.col{padding:22px 34px 22px 0}.col.r{padding:22px 0 22px 34px;border-left:1px solid var(--line)}}.col .k{font-family:var(--sans);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:8px}.col h3{font-family:var(--serif);font-weight:500;font-size:20px;color:var(--txt);margin:0 0 4px}.col .big{font-family:var(--serif);font-size:40px;color:var(--terra);line-height:1;font-variant-numeric:tabular-nums}.col .big.blue{color:var(--azul)}.col p{font-size:14.5px;color:var(--dim);margin:8px 0 10px;max-width:46ch}.col p b{color:var(--txt2)}.col .go{font-family:var(--sans);font-size:13px}.col .go a{color:var(--gold-ink)}.classics{display:flex;flex-wrap:wrap;gap:8px}.classics span{font-family:var(--serif);font-size:15px;color:var(--txt2);border-bottom:1px solid var(--line);padding-bottom:1px}.classics span .m{font-family:var(--mono);font-size:11px;color:var(--dim);margin-left:5px}' +
    '.years{display:grid;grid-template-columns:repeat(auto-fill,minmax(116px,1fr));gap:1px;background:var(--line);border:1px solid var(--line)}.yr-cell{background:var(--bg);padding:12px 13px;text-decoration:none;display:block}.yr-cell:hover{background:var(--surface2)}.yr-cell .y{font-family:var(--mono);font-size:17px;color:var(--txt)}.yr-cell .m{font-family:var(--sans);font-size:11px;color:var(--dim);margin-top:3px;line-height:1.5}.yr-cell .bar{height:3px;margin-top:7px;border-radius:2px;background:var(--line)}' +
    '.entries{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));border-top:1px solid var(--line)}.entry{padding:15px 20px 15px 0;border-bottom:1px solid var(--line);text-decoration:none;display:block}.entry .e-k{font-family:var(--serif);font-size:16px;color:var(--txt)}.entry:hover .e-k{color:var(--gold-ink)}.entry .e-v{font-family:var(--mono);font-size:12px;color:var(--dim);margin-top:3px}' +
    '.a-note{font-family:var(--sans);font-size:11.5px;color:var(--dim);background:var(--surface2);border-left:2px solid var(--gold);padding:8px 12px;margin:24px 0 0;border-radius:0 3px 3px 0}' +
    '.legend-sym{font-family:var(--sans);font-size:12px;color:var(--dim);margin-top:18px}.legend-sym b.ex{color:var(--terra)}.legend-sym b.re{color:var(--gold-ink)}.legend-sym b.fi{color:var(--dim)}';
  const head = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"icon\" href=\"/favicon.ico\" sizes=\"48x48\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-light.svg\" media=\"(prefers-color-scheme: light)\"><link rel=\"icon\" type=\"image/svg+xml\" href=\"/icon-dark.svg\" media=\"(prefers-color-scheme: dark)\"><link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/apple-touch-icon.png\"><link rel=\"manifest\" href=\"/site.webmanifest\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + _esc(desc) + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/atlas\"><link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/atlas\"><link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/atlas\">" +
    "<meta property=\"og:type\" content=\"website\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    _chromeCss(CSS) + "</head><body>" + _header(en) + "<main id=\"main\"><div class=\"atlas\">";
  // corpo: as seções são preenchidas pelo cliente a partir de window.ATLAS (paisagem interativa, gavetas accordion)
  const body =
    "<section class=\"a-hero\"><span class=\"eyb\">" + (en ? "Radar Perene · the archive" : "Radar Perene · o arquivo") + "</span>" +
    "<h1>" + (en ? "Atlas of the Brazilian Market" : "Atlas do Mercado Brasileiro") + "</h1>" +
    "<p class=\"sub\">" + (en ? "The market seen through time — each edition, a portrait of the market’s state that day." : "O mercado visto através do tempo — cada edição, um retrato do estado do mercado naquele dia.") + "</p>" +
    "<p class=\"thesis\"><b id=\"a-total\">" + total.toLocaleString(en ? "en-US" : "pt-BR") + "</b> " + (en ? "readings of the Brazilian market since the year 2000." : "leituras do mercado brasileiro desde o ano 2000.") + "</p>" +
    "<p class=\"a-stats\"><span><b>" + anos + "</b> " + (en ? "years observed" : "anos observados") + "</span><span class=\"sep\">·</span><span><b>" + total.toLocaleString(en ? "en-US" : "pt-BR") + "</b> " + (en ? "readings" : "leituras") + "</span><span class=\"sep\">·</span><span><b>" + (A.viradas || 0) + "</b> " + (en ? "cycle turns" : "grandes viradas") + "</span><span class=\"sep\">·</span><span><b>100%</b> " + (en ? "public" : "públicas") + "</span><span class=\"sep\">·</span><span>" + (en ? "citable archive" : "arquivo citável") + "</span></p></section>" +
    "<section class=\"respira\" aria-live=\"polite\"><div class=\"lb\">◎ " + (en ? "from the archive" : "do arquivo") + " <span class=\"dots\" id=\"r-dots\"></span></div><p class=\"body\" id=\"r-body\"></p><p class=\"cta\"><a href=\"#\" id=\"r-cta\"></a></p></section>" +
    "<hr class=\"a-rule\">" +
    "<section class=\"a-sec\"><h2>" + (en ? "What do you want to discover?" : "O que você quer descobrir?") + "</h2><p class=\"a-lead\">" + (en ? "The archive isn’t browsed by date — it’s browsed by question. The date is just the consequence of the query." : "O arquivo não se navega por data — se navega por pergunta. A data é só a consequência da consulta.") + "</p><div class=\"drawers\" id=\"drawers\"></div></section>" +
    "<hr class=\"a-rule\">" +
    "<section class=\"a-sec\"><h2>" + (en ? "The landscape of risk" : "A paisagem do risco") + "</h2><p class=\"a-lead\">" + (en ? "Twenty-six years of the Perene Risk Index, month by month. Each ridge is a state of the market; each valley, an episode of fear. Hover — click to open the edition." : "Vinte e seis anos do Índice de Risco Perene, mês a mês. Cada relevo é um estado do mercado; cada vale, um episódio de medo. Passe o mouse — clique para abrir a edição.") + "</p><div class=\"paisagem\"><div class=\"pais-scale\"><span>" + (en ? "euphoria · risk-on" : "euforia · risco ligado") + "</span><span>" + (en ? "fear · capitulation" : "medo · capitulação") + "</span></div><div class=\"pais-box\" id=\"pais\"><div class=\"pais-tip\" id=\"tip\"></div></div><div class=\"pais-legend\"><span><i style=\"background:var(--terra)\"></i>" + (en ? "risk-on" : "risco ligado") + "</span><span><i style=\"background:var(--slate)\"></i>" + (en ? "defensive" : "defensivo") + "</span><span><i style=\"background:var(--oliva)\"></i>" + (en ? "neutral" : "neutro") + "</span><span class=\"foot\">" + (en ? "The monthly regime shows in the lower strip; the line is the daily Perene Risk Index, aggregated by month." : "O regime (mensal) aparece na faixa inferior; a linha é o Índice de Risco Perene diário, agregado por mês.") + "</span></div></div></section>" +
    "<hr class=\"a-rule\">" +
    "<section class=\"a-sec\"><h2>" + (en ? "Collections" : "Coleções") + "</h2><p class=\"a-lead\">" + (en ? "The archive organized by phenomenon — not by calendar. This is where the edge lives: how many times it has already happened." : "O arquivo organizado por fenômeno — não por calendário. É aqui que mora o diferencial: quantas vezes já aconteceu.") + "</p>" +
    "<div class=\"cols\"><div class=\"col\"><span class=\"k\">" + (en ? "Extreme regimes" : "Regimes extremos") + "</span><div class=\"big blue\">" + (A.ge90 || 0).toLocaleString(en ? "en-US" : "pt-BR") + "</div><h3>" + (en ? "times the Perene Index passed 90" : "vezes o Índice Perene passou de 90") + "</h3><p>" + (en ? "Risk appetite at the top of the scale — from January 2000 to today. And <b>" + (A.le10 || 0).toLocaleString('en-US') + "</b> times it hit the floor (≤10): capitulation." : "O apetite ao risco no topo da escala — de janeiro de 2000 à edição de hoje. E <b>" + (A.le10 || 0).toLocaleString('pt-BR') + "</b> vezes ele tocou o piso (≤10): a capitulação.") + "</p><a class=\"go\" href=\"#drawers\">" + (en ? "Explore the extremes →" : "Explorar os extremos →") + "</a></div>" +
    "<div class=\"col r\"><span class=\"k\">" + (en ? "Cycle turns" : "Viradas de ciclo") + "</span><div class=\"big\">" + (A.viradas || 0) + "</div><h3>" + (en ? "regime changes since 2010" : "mudanças de regime desde 2010") + "</h3><p>" + (en ? "When the market changed its structural mood." : "Quando o mercado trocou de humor estrutural.") + "</p><a class=\"go\" href=\"#drawers\">" + (en ? "Explore the turns →" : "Explorar as viradas →") + "</a></div>" +
    "<div class=\"col\" style=\"grid-column:1/-1;border-left:0;padding-right:0\"><span class=\"k\">" + (en ? "Classic cases" : "Casos clássicos") + "</span><h3 style=\"margin-bottom:10px\">" + (en ? "The market’s history, by event" : "A história do mercado, por acontecimento") + "</h3><div class=\"classics\" id=\"classics\"></div></div></div></section>" +
    "<hr class=\"a-rule\">" +
    "<section class=\"a-sec\"><h2>" + (en ? "Explore by period" : "Explorar por período") + "</h2><p class=\"a-lead\">" + (en ? "Twenty-six years, not six thousand lines. Each year is a chapter." : "Vinte e seis anos, não seis mil linhas. Cada ano é um capítulo.") + "</p><div class=\"years\" id=\"years\"></div></section>" +
    "<hr class=\"a-rule\">" +
    "<section class=\"a-sec\"><h2>" + (en ? "Start here" : "Comece por aqui") + "</h2><p class=\"a-lead\">" + (en ? "Doors in for those who don’t yet know what to look for." : "Portas de entrada para quem não sabe o que procurar.") + "</p><div class=\"entries\" id=\"entries\"></div>" +
    "<p class=\"legend-sym\"><b class=\"ex\">●</b> " + (en ? "extreme" : "extremo") + " · <b class=\"re\">◐</b> " + (en ? "recurring" : "recorrente") + " · <b class=\"fi\">○</b> " + (en ? "first occurrence" : "primeira ocorrência") + " — " + (en ? "the reader learns the symbols over time, without a legend." : "o leitor aprende os símbolos com o tempo, sem legenda.") + "</p></section>" +
    "<div class=\"ad-slot\" data-ad-type=\"multiplex\" style=\"margin:30px 0 0\"></div>" +
    "<p class=\"a-note\">" + (en ? "Public, citable archive · daily Perene Risk Index 2000–2026, monthly regime 2010–2026. Descriptive, never a forecast or recommendation. Public sources." : "Arquivo público e citável · Índice de Risco Perene diário 2000–2026, regime mensal 2010–2026. Descritivo, nunca previsão ou recomendação. Fontes públicas.") + "</p>" +
    (_edLast ? "<nav class=\"a-edlinks\" aria-label=\"" + (en ? "Recent cycle-turn editions" : "Edições de virada recentes") + "\" style=\"font-size:13px;color:var(--dim);margin:22px 0 0;line-height:1.9\"><span style=\"font-family:var(--sans);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-right:8px\">" + (en ? "Turn editions" : "Edições de virada") + "</span>" + _edLast + "</nav>" : "") +
    "</div></main><footer><a href=\"" + dpath + "\">" + (en ? "← All daily editions" : "← Todas as edições diárias") + "</a> · <a href=\"" + (en ? "/track-record" : "/historico") + "\">" + (en ? "Track record" : "Track record") + "</a> · <a href=\"/\">" + (en ? "Full radar" : "Radar completo") + "</a></footer>";
  const script = "<script>window.ATLAS=" + JSON.stringify(client).replace(/</g, "\\u003c") + ";</script>" + _ATLAS_JS + "<script src=\"/ads.js\" defer></script>" + _themeScript() + _CONSENT;
  return new Response(head + body + script + "</body></html>", { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
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
    "<p class=\"atlasl\" style=\"margin:.2rem 0 1rem\"><a href=\"/atlas\" style=\"color:var(--gold-ink);font-weight:600;text-decoration:none\">" + (en ? "◎ Explore the archive as an Atlas — by regime, extreme, crisis, landscape →" : "◎ Explore o arquivo como Atlas — por regime, extremo, crise, paisagem →") + "</a><br><a href=\"" + (en ? "/track-record" : "/historico") + "\" style=\"color:var(--gold-ink);text-decoration:none;font-size:13px\">" + (en ? "See the track record — readings vs. outcome →" : "Ver o track record — leitura vs. desfecho →") + "</a></p>" +
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
    // ── /atlas — Atlas do Mercado Brasileiro (navegação por fenômeno; /diario cronológico continua existindo) ──
    if (_url.pathname === "/atlas") {
      try {
        const r = await _diarioFetch(ATLAS_API + "?lang=" + (_isEN ? "en" : "pt"));
        if (!r.ok) return env.ASSETS.fetch(request);
        return _renderAtlas(await r.json(), _url.origin, _isEN ? "en" : "pt");
      } catch (e) { return env.ASSETS.fetch(request); }
    }
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
        try {
          const sl = await _diarioFetch(SNAPS_API);
          if (sl.ok) {
            const itens = (await sl.json()).itens || [];
            const ds = itens.map(function (x) { return x.data; });
            const ix = ds.indexOf(_dm[1]);
            if (ix >= 0) {
              nav.next = ix > 0 ? ds[ix - 1] : null; nav.prev = ix < ds.length - 1 ? ds[ix + 1] : null; nav.num = ds.length - ix;
              const cur = itens[ix], prv = itens[ix + 1];
              if (cur && prv) {  // deltas do Pulso (Perene/Ânima pulsam por dia; o SNAPS já traz por data)
                if (cur.perene != null && prv.perene != null) nav.dPerene = Math.round(cur.perene - prv.perene);
                if (cur.anima != null && prv.anima != null) nav.dAnima = Math.round(cur.anima - prv.anima);
                if (cur.curto != null && prv.curto != null) nav.dCurto = Math.round(cur.curto - prv.curto);
              }
              const rl = cur && cur.regime_label;  // "regime · há N dias": corre p/ trás enquanto o label do regime não muda
              if (rl != null) {
                let j = ix; while (j + 1 < itens.length && itens[j + 1].regime_label === rl) j++;
                const d0 = itens[j] && itens[j].data;
                if (d0) nav.regimeDias = Math.max(0, Math.round((Date.parse(_dm[1]) - Date.parse(d0)) / 86400000));
              }
            }
          }
        } catch (e) { /* opcional */ }
        // "O Arquivo Lembra" — acervo maturado inteiro p/ a timeline do mesmo regime (degrada gracioso se falhar)
        try { const hr = await _diarioFetch(HIST_API + "?limit=600&lang=" + (_isEN ? "en" : "pt")); if (hr.ok) nav.historico = await hr.json(); } catch (e) { /* opcional */ }
        // recorrência por ESTADO (Perene) daquela data — o rodapé do Arquivo casa 1:1 com a home; date-parametrizada, determinística
        try { const rr = await _diarioFetch(RECORR_API + "?date=" + _dm[1]); if (rr.ok) { const rj = await rr.json(); if (rj && rj.n) nav.recorrencia = rj; } } catch (e) { /* opcional */ }
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
      // ★ barra de topo → Atlas do Mercado Brasileiro (o arquivo como instrumento). Aditiva, no topo do body, lang-aware.
      rw = rw.on("body", { element(e) { e.prepend('<a href="/atlas" style="display:block;background:#1a1a2e;color:#faf9f6;text-decoration:none;font-family:Inter,system-ui,sans-serif;font-size:13px;text-align:center;padding:9px 16px;line-height:1.4">' + (isEN ? '<b style="color:#d9a441;font-weight:600">New</b> &middot; <b>Atlas of the Brazilian Market</b> — 26 years of the archive, navigable by phenomenon <span style="color:#d9a441">&rarr;</span>' : '<b style="color:#d9a441;font-weight:600">Novo</b> &middot; <b>Atlas do Mercado Brasileiro</b> — 26 anos do acervo, navegável por fenômeno <span style="color:#d9a441">&rarr;</span>') + '</a>', { html: true }); } });
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
