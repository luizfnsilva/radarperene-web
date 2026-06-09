// Cloudflare Worker (static assets) — serve EN-static no domínio .com, inclusive p/ crawler SEM JS.
// Ambos domínios servem o MESMO index.html (PT estático). Só no .com raiz transformamos
// title/meta/OG/FAQ/lang para EN via HTMLRewriter (stream). DEFENSIVO: erro → serve o original.
// run_worker_first está escopado a "/" e "/index.html" → todo o resto serve estático (risco mínimo).

const EN_TITLE = "Radar Perene — Brazil market regime & country risk, read as data";
const EN_DESC = "Brazil's market and regulatory regime, read as data: macro, rates/Selic, country risk, intermarket, FX, REITs and the equity risk premium (earnings yield vs real rate) — across 5 lenses plus the Vertice experiment. Charts with fair value and a scenario cone. Descriptive, public-source, never a recommendation.";
const EN_FAQ = JSON.stringify({
  "@context": "https://schema.org", "@type": "FAQPage", "inLanguage": "en", "mainEntity": [
    { "@type": "Question", "name": "How does Radar Perene compute Brazil's macro regime?", "acceptedAnswer": { "@type": "Answer", "text": "A monthly cross-market sensor outputs a Risk-BR score (0-100) from 8 domestic sub-scores (liquidity, defensive rotation, credit stress and more), calibrated on central-bank expectations (Focus since 2001) and real-rate curves (long NTN-B since 2006), isolating statistically-significant anomalies in 36-month windows." } },
    { "@type": "Question", "name": "What is the Founder price and what changes later?", "acceptedAnswer": { "@type": "Answer", "text": "US$ 149/month (or US$ 1,490/year, 2 months free), locked for your subscription while it stays active, and it includes all five Lenses and the Vertice Experiment. Later the Lenses will be sold a la carte (the Vertice alone will be US$ 290); together they exceed US$ 490/month. Founder secures them all for US$ 149. It is the same product, not a separate premium. Important: today about 90% of the functions and tickers are not available yet and roll out gradually, at no extra cost; the founder price locks your rate while everything ships." } },
    { "@type": "Question", "name": "How do payment and the 7-day window work?", "acceptedAnswer": { "@type": "Answer", "text": "Payment is taken at signup (R$ on .com.br, US$ on .com), processed by Stripe. You have a 7-day full, automatic refund window, a legal right. After 7 days the normal recurrence continues. Cancel anytime in the portal, no human desk." } },
    { "@type": "Question", "name": "How do support, cancellation and data deletion work?", "acceptedAnswer": { "@type": "Answer", "text": "All subscription management, cancellation, refunds, card changes and invoices, is 100% self-service via the Stripe Customer Portal, in one click. Account and data deletion is also one click in your profile; we store nothing beyond your Google/Apple login and email." } },
    { "@type": "Question", "name": "Is this investment advice?", "acceptedAnswer": { "@type": "Answer", "text": "No. Under our P7 protocol the system is strictly descriptive: it reads regimes and anomalies from public sources and never recommends, predicts a price, or gives financial advice." } }
  ]
});

// ── SSR-EN do BODY da home (.com) p/ crawler SEM JS ────────────────────────────────
// O index.html é PT estático; o JS (catálogo C, branch EN) reescreve em-browser. O crawler
// sem-JS via PT. Aqui replicamos a MESMA branch EN p/ injetar via HTMLRewriter no .com.
// FONTE DA VERDADE: index.html linhas ~367-467 (branch EN do catálogo C + builders).
// Se aquele catálogo mudar, ESTE bloco precisa acompanhar (sem framework SSR no projeto).
const EN_BODY = (function () {
  const C = {
    h1: 'Brazil&rsquo;s regime, read as <span class="g">data</span> — not opinion.',
    lead: "Five Lenses on Brazil&rsquo;s regime — wealth, electoral, macro, institutional and real-estate — plus the cross-asset Vértice Experiment. You choose the depth of the read. Live, below.",
    cta1: "Join the 100 founders", cta2: "See the live radar", micro: "Educational content, public sources. Descriptive — never a recommendation.",
    eyb7: "Who it&rsquo;s for", s7: "Investors, analysts, managers — and serious newcomers.", s7s: "For anyone who wants to read Brazil&rsquo;s market regime without noise or guesswork, at the depth they choose — from a one-line read to the data behind it.",
    eyb2: "What it is", s2: "Five Lenses on Brazil — and one Experiment", s2s: "Not a newsletter. An instrument that reads the regime of each regulatory domain, in layers. See the structure; today&rsquo;s live reading is right below.",
    eyb5: "Depth", s5: "You choose the depth", s5s: "Each lens opens in layers — from the regime headline to the math made visible: a <b>quantile cone</b> (distribution of outcomes, never a forecast), <b>Trend Score</b> 0&ndash;10, real <b>breadth</b> (% of stocks above their 200-day average), the <b>analog study</b> (this setup happened N times → what followed) and <b>lead-lag</b>. No ceiling for those who want to go deep.",
    eyb6: "What&rsquo;s underneath",
    eyb1: "Live · today", s1: "Today&rsquo;s reading", s1s: "A sample of the engine over today&rsquo;s public data. History, scenarios and free cross-analysis are in the paid plan.",
    fbadge: "Launch · seats limited to the first 100 founders", fh: "The 100 founders unlock all five Lenses — and the Vértice Experiment", fp: "For US$149/mo — locked while your subscription stays active — you unlock what historically happened next: the full distribution of analogous cases per asset (probability of rising, median return and range over 3/6/12 months), the full quantile cone, a chart you can work. Plus all five Lenses and the Vértice Experiment. In the future the Lenses will be sold à la carte (Vértice alone will be US$290); together they add up to more than US$490/month. Pay upfront, 7-day full automatic refund (via Stripe), cancel in one click.",
    fdisc: "⚠ Work in progress: today about <b>90% of the functions and tickers aren&rsquo;t available yet</b> — they roll out gradually, at no extra cost, with your founder price locked. You secure everything as it ships; you&rsquo;re not paying for a complete product today.",
    wlbtn: "Get my invite",
    eyb3: "For your site · free", s3: "Use our mini-radar anywhere", s3s: "A free public endpoint with today&rsquo;s reading (JSON). Embed it, cite the source. Great for portals, newsletters and communities.",
    eyb4: "Principles",
    disc: "Educational and informational content from public sources. Descriptive — NOT investment advice, an offer, solicitation or financial counsel.",
    ftnav: '<a href="/daily">Daily archive</a> · <a href="/how-to-read-the-radar/">How to read</a> · <a href="/methodology/">Methodology</a> · <a href="/lenses/">Lenses</a> · <a href="/concepts/">Concepts</a> · <a href="/free/">Free</a> · <a href="/about">About</a> · <a href="/ativos">Assets</a> · <a href="/lenses/wealth/">Wealth</a> · <a href="/lenses/electoral/">Electoral</a> · <a href="/lenses/macro/">Macro</a> · <a href="/lenses/institutional/">Institutional</a> · <a href="/lenses/real-estate/">Real estate</a> · <a href="/lenses/vertice/">Vértice</a> · <a href="/concepts/regime-brazil/">Brazil Regime</a> · <a href="/concepts/regime-global/">Global Regime</a> · <a href="/concepts/intermarket-br/">Intermarket BR</a> · <a href="/concepts/erp-br/">ERP_BR</a> · <a href="/concepts/logarithmic-regression-cone/">Regression Cone</a> · <a href="/concepts/anima-index/">Ânima</a> · <a href="/concepts/risk-on-risk-off/">Perene Risk Index</a> · <a href="/concepts/historical-analogs/">Historical analogs</a> · <a href="/concepts/vertice/">Vértice (concept)</a> · <a href="/founder/">Founder</a> · <a href="/api/docs/">API</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a>',
    lenses: [{ n: "Wealth", d: "Succession, estate tax, holdings and structures — pressure on wealth." },
      { n: "Electoral", d: "Electoral courts, eligibility, campaign finance and digital enforcement." },
      { n: "Macro / Rates", d: "Rates, inflation, fiscal and debt — the country&rsquo;s macro regime." },
      { n: "Institutional", d: "Laws, taxes and rulings in the making that touch wealth and succession." },
      { n: "Real estate", d: "REITs, real-estate credit, registries and sector regulation." },
      { n: "Vértice", d: "The experiment: cross-asset thermometers, breadth and historical analogs.", v: 1, m: "Contextual hypothesis, not a forecast." }],
    ladder: [{ t: "Briefing", d: "the essentials in 5 seconds" }, { t: "Lens", d: "stress by domain" }, { t: "Scenarios", d: "trajectories and windows" }, { t: "War Room", d: "proof and propagation" }, { t: "Modeling", d: "cross everything · 50+ yrs · k-NN" }],
    scale: [["26", "years of BR market data"], ["70", "stocks in deep series"], ["8", "Risk-BR sub-scores"], ["187", "months in the analog study"], ["FDR", "statistically-significant correlations"]],
    princ: [["Descriptive", "We read and contextualize the regime — we never recommend or predict a price."],
      ["Public sources", "Built on public data. Low-noise, auditable, transparent."],
      ["Contradiction on show", "Every reading carries its own counter-evidence. No false certainty."]],
    eyb8: "Free × Founder", s8: "What you unlock as a Founder", s8s: "Free shows <b>where we are</b> — today&rsquo;s regime, lenses, mood and valuation. Founder answers <b>what historically happened next</b>: the full distribution of analogous cases (probability of rising, median and range over 3/6/12 months) + the quantile cone, a working chart and all 6 Lenses (with Vértice). US$149/mo, locked while your subscription stays active; items marked &ldquo;coming&rdquo; arrive as the product grows.",
    eyb9: "FAQ", s9: "How it works",
    tiers: [["Today&rsquo;s reading — where we are (regime, 5 Lenses, intermarket, mood, valuation)", "✓", "✓"], ["Embeddable mini-radar (public API)", "✓", "✓"], ["Similar historical cases — that they exist and how many", "✓", "✓"], ["What historically happened next — probability of rising, median and range (3/6/12m)", "—", "✓ now"], ["Full quantile cone (p10–p90) + overlaid analogs", "—", "✓ now"], ["Work the chart — free-range zoom, compare A×B, overlays", "—", "✓ now"], ["Price locked while your subscription stays active · a seat among the 100", "—", "✓ now"], ["All 6 Lenses — including the Vértice Experiment", "—", "guaranteed"], ["Long history + anomalies + regime-turn alerts", "—", "coming"], ["3 L3 reads — economist, lawyer, accountant", "—", "coming"]],
    faq: [["How does Radar Perene compute Brazil&rsquo;s macro regime?", "A monthly cross-market sensor outputs a Risk-BR score (0–100) from 8 domestic sub-scores (liquidity, defensive rotation, credit stress and more), calibrated on central-bank expectations (Focus since 2001) and real-rate curves (long NTN-B since 2006), isolating statistically-significant anomalies in 36-month windows."], ["What is the Founder price and what changes later?", "US$ 149/month (or US$ 1,490/year · 2 months free), locked for your subscription while it stays active — and it includes all five Lenses and the Vértice Experiment. In the future the Lenses will be sold à la carte (Vértice alone will be US$290); together they exceed US$490/month. Founder secures them all for US$ 149. You join the preliminary product now and get full access when it is ready — the same product, not a separate premium. Important: today about 90% of the functions and tickers aren&rsquo;t available yet and roll out gradually, at no extra cost; you pay the (locked) founder price to secure everything as it ships, not for a complete product today."], ["How do payment and the 7-day window work?", "Payment is taken at signup (R$ on the .com.br domain, US$ on .com), processed by Stripe. You have a 7-day full, automatic refund window — a legal right, no friction. After 7 days the normal recurrence (monthly or annual) continues. Everything is managed by you in the Stripe Customer Portal — there is no human support desk."], ["How do support, cancellation and data deletion work?", "ALL subscription management — cancellation, refunds, card changes and invoices — is 100% self-service via the Stripe Customer Portal, anytime, in one click. There is no human support desk: you handle everything yourself, in the portal. Account and data deletion is also one click in your profile — we store nothing beyond your Google/Apple login and email."], ["Is this investment advice?", "No. Under our P7 protocol the system is strictly descriptive — it reads regimes and anomalies from public sources and never recommends, predicts a price, or gives financial advice."]]
  };
  const LSLUG = ["patrimonial", "eleitoral", "macro", "institucional", "imobiliaria", "vertice"];
  const ELEN = { patrimonial: "wealth", eleitoral: "electoral", institucional: "institutional", imobiliaria: "real-estate" };
  const ECON = { "regime-brasil": "regime-brazil", "intermercado-br": "intermarket-br", "cone-de-regressao-logaritmica": "logarithmic-regression-cone", "indice-anima": "anima-index", "analogos-historicos": "historical-analogs" };
  const U_MET = "/methodology/", U_CON = "/concepts/", U_LEN = "/lenses/", U_HOW = "/how-to-read-the-radar/";
  const LP = (s) => U_LEN + (ELEN[s] || s) + "/";
  const CP = (s) => U_CON + (ECON[s] || s) + "/";
  const expTag = "experiment";
  const NAV = { met: "Methodology", con: "Concepts", len: "Lenses", dia: "Daily", howto: "How to read", free: "Free", ac: "All concepts →", al: "All lenses →" };
  const CN = [["regime-brasil", "Brazil Regime"], ["regime-global", "Global Regime"], ["intermercado-br", "Intermarket BR"], ["erp-br", "ERP_BR"], ["cone-de-regressao-logaritmica", "Logarithmic Cone"], ["indice-anima", "Ânima Index"], ["risk-on-risk-off", "Perene Risk Index"], ["analogos-historicos", "Historical Analogs"], ["vertice", "Vértice"]];
  const CD = ["Brazil's prevailing market state", "the external environment pressing on Brazil", "cross-reading of Brazilian wealth-sector ratios", "Brazilian equity risk premium in historical percentile", "frames price against the long-term trajectory", "proprietary reading of Brazilian market mood", "Brazil's risk-appetite gauge (0–100), stacked with Ânima", "past windows with a similar profile", "cross-domain hypotheses under Bayesian discipline"];
  const lenses = C.lenses.map((l, i) => '<a class="ln' + (l.v ? ' vx' : '') + '" href="' + LP(LSLUG[i]) + '"><div class="nm">' + (l.v ? '<span style="color:var(--gold)">✦</span> ' : '') + l.n + (l.v ? '<span class="tag">' + expTag + '</span>' : '') + '</div><p>' + l.d + '</p>' + (l.m ? '<span class="micro">' + l.m + '</span>' : '') + '</a>').join("");
  const conDD = CN.map((c) => '<a href="' + CP(c[0]) + '">' + c[1] + '</a>').join("") + '<a href="' + U_CON + '" style="color:var(--gold)">' + NAV.ac + '</a>';
  const lenDD = C.lenses.map((l, i) => '<a href="' + LP(LSLUG[i]) + '">' + l.n + '</a>').join("") + '<a href="' + U_LEN + '" style="color:var(--gold)">' + NAV.al + '</a>';
  const topnav = '<a href="' + U_MET + '">' + NAV.met + '</a><span class="dd"><a href="' + U_CON + '" tabindex="0">' + NAV.con + ' ▾</a><div class="ddm">' + conDD + '</div></span><span class="dd"><a href="' + U_LEN + '" tabindex="0">' + NAV.len + ' ▾</a><div class="ddm">' + lenDD + '</div></span><a href="/daily">' + NAV.dia + '</a><a href="' + U_HOW + '">' + NAV.howto + '</a><a href="/free/">' + NAV.free + '</a>';
  const cgrid = CN.map((c, i) => '<a href="' + CP(c[0]) + '"><span class="cn">' + c[1] + '</span><span class="cd">' + CD[i] + '</span></a>').join("");
  const ladder = C.ladder.map((s, i) => '<div class="st"><div class="no">' + (i + 1) + '</div><div class="ti">' + s.t + '</div><div class="de">' + s.d + '</div></div>').join("");
  const scale = C.scale.map((s) => '<div class="st"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>').join("");
  const princ = C.princ.map((p) => '<div><b>' + p[0] + '.</b> ' + p[1] + '</div>').join("");
  const tiers = '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="text-align:left;padding:9px 6px;border-bottom:1px solid #222a31;color:#8b97a3;font-weight:600"></th><th style="padding:9px 6px;border-bottom:1px solid #222a31;color:#8b97a3;font-weight:600;width:25%">Free</th><th style="padding:9px 6px;border-bottom:1px solid #222a31;color:#c9a227;font-weight:700;width:25%">Founder</th></tr></thead><tbody>' + C.tiers.map((r) => '<tr><td style="text-align:left;padding:9px 6px;border-bottom:1px solid #222a31">' + r[0] + '</td><td style="text-align:center;padding:9px 6px;border-bottom:1px solid #222a31;color:#8b97a3">' + r[1] + '</td><td style="text-align:center;padding:9px 6px;border-bottom:1px solid #222a31">' + r[2] + '</td></tr>').join("") + '</tbody></table>';
  const faqbox = C.faq.map((f) => '<div style="border-top:1px solid #222a31;padding:13px 0"><b style="display:block;margin-bottom:5px">' + f[0] + '</b><p style="margin:0;color:#8b97a3;font-size:14px;line-height:1.6">' + f[1] + '</p></div>').join("");
  return {
    "h1": C.h1, "lead": C.lead, "cta1": C.cta1, "cta2": C.cta2, "micro1": C.micro,
    "eyb7": C.eyb7, "s7": C.s7, "s7s": C.s7s, "eyb2": C.eyb2, "s2": C.s2, "s2s": C.s2s,
    "eyb-lng": "The Radar's language", "s-lng": "The concepts behind the reading", "s-lng-s": "Regime, lenses, intermarket, percentile, analog, hypothesis. Those who understand this language read the product — each term has its own page.", "lng-cta": "See the full Radar language →",
    "eyb5": C.eyb5, "s5": C.s5, "s5s": C.s5s, "eyb6": C.eyb6,
    "eyb8": C.eyb8, "s8": C.s8, "s8s": C.s8s,
    "eyb1": C.eyb1, "s1": C.s1, "s1s": C.s1s,
    "fbadge": C.fbadge, "fh": C.fh, "fp": C.fp, "wl-btn": C.wlbtn,
    "eyb-ult": "Latest readings", "s-ult": "The day's regime — archived and auditable", "s-ult-s": "The Radar publishes the day's regime daily. Each entry is brief, dated and verifiable — the full history crosses past and future.", "ult-cta": "See the full Diary →",
    "eyb3": C.eyb3, "s3": C.s3, "s3s": C.s3s, "eyb4": C.eyb4, "disc": C.disc,
    "eyb9": C.eyb9, "s9": C.s9, "qtag-txt": "CURRENT SIGNAL · REGIME BR",
    "lenses": lenses, "topnav": topnav, "conceitos-grid": cgrid, "ladder": ladder, "scale": scale, "princ": princ, "tiers": tiers, "faqbox": faqbox, "ftnav": C.ftnav
  };
})();

// JSON-LD @graph (Organization/WebSite/Dataset/Service) em EN p/ o .com (o JS NÃO traduz este graph).
const EN_GRAPH = JSON.stringify({
  "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": "https://radarperene.com/#org", "name": "Radar Perene", "alternateName": "Método Perene", "url": "https://radarperene.com", "email": "hello@brazilcomplexity.com", "logo": "https://radarperene.com/og.png", "image": "https://radarperene.com/og.png", "description": "Brazil regime-intelligence instrument — descriptive, in-house, public-source. It reads the macro, rates, intermarket, regulatory and judicial environment and shows what is happening today, from basic to advanced. Not investment advice.", "knowsLanguage": ["en", "pt-BR"], "areaServed": { "@type": "Country", "name": "Brazil" }, "sameAs": ["https://radarperene.com.br"] },
    { "@type": "WebSite", "@id": "https://radarperene.com/#website", "url": "https://radarperene.com", "name": "Radar Perene", "publisher": { "@id": "https://radarperene.com/#org" }, "inLanguage": ["en", "pt-BR"], "potentialAction": { "@type": "SearchAction", "target": { "@type": "EntryPoint", "urlTemplate": "https://radarperene.com/?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
    { "@type": "Dataset", "@id": "https://radarperene.com/#dataset", "name": "Radar Perene — Brazil market regime, macro and intermarket", "description": "Descriptive series and scores of the market regime, rates/Selic, country risk, intermarket, FX, REITs (IFIX), Treasury, crypto and the equity risk premium (earnings yield vs real rate), plus regulatory/judicial activity. Public data since 2000, continuously updated. Descriptive, never a recommendation or price forecast.", "url": "https://radarperene.com/", "creator": { "@id": "https://radarperene.com/#org" }, "isAccessibleForFree": true, "license": "https://radarperene.com/", "inLanguage": ["en", "pt-BR"], "spatialCoverage": { "@type": "Place", "name": "Brazil" }, "temporalCoverage": "2000-01-01/..", "keywords": ["market regime", "country risk", "Brazil macro", "interest rates", "Selic", "intermarket", "FX", "equity risk premium", "fair value", "IFIX", "REITs", "IBOV", "Brazilian Treasury", "Brazil valuation"], "variableMeasured": ["regime_br_score", "risk_global_score", "equity risk premium", "fair value", "intermarket"], "distribution": { "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "https://radarperene.com/INTEGRACAO_RADAR.md" } },
    { "@type": "Service", "@id": "https://radarperene.com/#service", "name": "Radar Perene Founder", "serviceType": "Descriptive market and regulatory intelligence", "provider": { "@id": "https://radarperene.com/#org" }, "areaServed": { "@type": "Country", "name": "Brazil" }, "description": "Full plan: long history, workable charts (free-range zoom, compare A×B, overlays and indicators), p10–p90 scenario cone, fair value and regime-turn alerts. Founder pricing for the first 100. Descriptive, never a recommendation." }
  ]
});

const NARR_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjanRrZ2x0cnhkbmxhY2V6cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTk3MDQsImV4cCI6MjA5NTc5NTcwNH0.CkEmnGCSTfF-9FjjebyeBUFV0-vW6CsfpyBea6cLCUs";
const NARR_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/narrative";
const IND_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/indicadores";
const SNAP_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/snapshot";
const SNAPS_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/snapshots";
const LDD_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/leitura-do-dia";
const COB_API = "https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/cobertura";

// ── cobertura VIVA: 1 fetch cacheado (1h) → preenche spans [data-cob] em QUALQUER página HTML ──
// "engrenagem só": adicionou dado no banco → a fn SQL cobertura_radar muda → o número novo flui pro site
// sozinho, sem rebuild. DEFENSIVO: API fora → mantém o fallback honesto já escrito no HTML.
async function _fetchCobertura() {
  try {
    const r = await fetch(COB_API, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
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
const _CONSENT = '<div id="rp-cookie" style="display:none;position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#13171c;border-top:1px solid #222a31;padding:14px 18px;font:13px/1.5 \'Inter\',system-ui,sans-serif;color:#e8ebee"><div style="max-width:1080px;margin:0 auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center"><span id="rp-ck-txt" style="flex:1;min-width:240px;color:#8b97a3">Usamos cookies de medição (analytics) para melhorar o site. Você escolhe — sem isso, nada é rastreado.</span><button id="rp-ck-no" style="background:transparent;border:1px solid #222a31;color:#e8ebee;padding:9px 16px;border-radius:8px;font-weight:600;cursor:pointer">Recusar</button><button id="rp-ck-yes" style="background:#c9a227;border:0;color:#0a0c0f;padding:9px 18px;border-radius:8px;font-weight:700;cursor:pointer">Aceitar</button></div></div>' +
  '<script>(function(){var EN=/radarperene\\.com$/i.test(location.hostname)&&!/\\.com\\.br$/i.test(location.hostname);if(EN){var t=document.getElementById("rp-ck-txt");if(t)t.textContent="We use measurement (analytics) cookies to improve the site. Your choice — nothing is tracked without it.";document.getElementById("rp-ck-no").textContent="Decline";document.getElementById("rp-ck-yes").textContent="Accept";}var KEY="rp-consent";window.rpTrack=function(name){if(localStorage.getItem(KEY)!=="granted")return;try{if(window.gtag)gtag("event",name);}catch(e){}};function loadAhrefs(){var AH=/\\.com\\.br$/i.test(location.hostname)?"4LbsuoMGfXN4azVzHW6wPQ":"m9HGU5S9vnFEBS9K4J62rg";var sa=document.createElement("script");sa.async=1;sa.src="https://analytics.ahrefs.com/analytics.js";sa.setAttribute("data-key",AH);document.head.appendChild(sa);}loadAhrefs();function loadAnalytics(){var GA=/\\.com\\.br$/i.test(location.hostname)?"G-4LVGNLRV9L":"G-CWB77T178R";var s=document.createElement("script");s.async=1;s.src="https://www.googletagmanager.com/gtag/js?id="+GA;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag("js",new Date());gtag("config",GA);}var c=localStorage.getItem(KEY),bar=document.getElementById("rp-cookie");if(c==="granted"){loadAnalytics();}else if(c!=="denied"){bar.style.display="block";}document.getElementById("rp-ck-yes").onclick=function(){localStorage.setItem(KEY,"granted");bar.style.display="none";loadAnalytics();};document.getElementById("rp-ck-no").onclick=function(){localStorage.setItem(KEY,"denied");bar.style.display="none";};})();<\/script>';
function _consentRw(rw) { return rw.on("body", { element(e) { e.append(_CONSENT, { html: true }); } }); }

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
    "</div><footer><a href=\"/\">" + L.back + "</a></footer>" + _themeScript() + _CONSENT + "</body></html>";
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
  const dpath = en ? "/daily" : "/diario";  // slug i18n: EN usa /daily, PT /diario (o .com 301-redireciona /diario→/daily)
  const canon = origin + dpath + "/" + date;
  const regime = inds.find(function (i) { return i.slug === "regime-br"; });
  const title = "Radar Perene — " + date + (en ? " · Brazil market regime" : " · regime do mercado BR");
  const _rl = regime ? (regime.classificacao || regime.leitura || "") : "", _rs = (regime && regime.valor != null) ? regime.valor + "/100" : "";
  const desc = _esc((en ? "Brazilian market regime on " + date + (_rl ? ": " + _rl + (_rs ? " (" + _rs + ")" : "") : "") + ". Archived daily reading by Radar Perene." : "Regime do mercado brasileiro em " + date + (_rl ? ": " + _rl + (_rs ? " (" + _rs + ")" : "") : "") + ". Leitura diária arquivada do Radar Perene.")).slice(0, 150);
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
  // ── Casos análogos — "o que veio depois" (olha pra FRENTE): distribuição de desfechos após leituras semelhantes,
  //    pareada com a Verificação (que olha pra trás). Frequência observada, NUNCA previsão. Consome /v1/snapshot.casos_analogos. ──
  const cas = snap.casos_analogos || null;
  let casHtml = "";
  if (cas && cas.horizontes && (cas.horizontes["3m"] || cas.horizontes["6m"] || cas.horizontes["12m"])) {
    const sgn = function (v) { return (v >= 0 ? "+" : "") + v + "%"; };
    const casLines = ["3m", "6m", "12m"].filter(function (k) { return cas.horizontes[k]; }).map(function (k) {
      const h = cas.horizontes[k];
      return k.toUpperCase() + ": " + (en ? "higher " : "em alta ") + h.alta_pct + "%" +
        (h.mediana != null ? " · " + (en ? "median " : "mediana ") + sgn(h.mediana) : "") +
        (h.p25 != null && h.p75 != null ? " · " + (en ? "central range " : "faixa central ") + sgn(h.p25) + "…" + sgn(h.p75) : "") +
        (h.n != null ? " (n=" + h.n + ")" : "");
    });
    const casTitle = cas.titulo || (en ? "Analogous cases — what came next" : "Casos análogos — o que veio depois");
    const casMeta = (cas.n_episodios != null ? (en ? cas.n_episodios + " independent episodes" : cas.n_episodios + " episódios independentes") : "") +
      (cas.exemplos && cas.exemplos.length ? " · " + (en ? "e.g. " : "ex. ") + cas.exemplos.slice(0, 5).join(", ") : "") +
      (cas.metodo ? " · " + cas.metodo : "");
    casHtml = "<div class=\"cas\"><b>" + _esc(casTitle) + "</b>" +
      (cas.leitura ? "<p class=\"casl\">" + _esc(cas.leitura) + "</p>" : "") +
      "<ul>" + casLines.map(function (l) { return "<li>" + _esc(l) + "</li>"; }).join("") + "</ul>" +
      (casMeta ? "<p class=\"casm\">" + _esc(casMeta) + "</p>" : "") +
      (!cas.leitura && cas.disclaimer ? "<p class=\"casm\">" + _esc(cas.disclaimer) + "</p>" : "") +
      "</div>";
  }
  // passado × futuro lado a lado (empilha no mobile): Verificação (trás) + Casos análogos (frente)
  const pfHtml = (verHtml || casHtml) ? "<div class=\"pf\">" + verHtml + casHtml + "</div>" : "";
  const IND_OK = { "regime-br": 1, "erp-br": 1, "valuation-br": 1, "ciclicas-defensivas": 1, "ibovespa": 1, "analogo-br": 1 };  // slugs com página /indicador real
  const CONC_MAP = { "regime-global": "regime-global", "intermercado-br": "intermercado-br" };  // reconstruídos → página de conceito (não /indicador, que 404ava)
  const indHtml = inds.map(function (i) {
    const v = i.valor != null ? " <b>" + _esc(_fmtVal(i.valor, i.unidade)) + "</b>" : "";
    const nm = IND_OK[i.slug] ? "<a href=\"/indicador/" + _esc(i.slug) + "\">" + _esc(i.nome) + "</a>" : (CONC_MAP[i.slug] ? "<a href=\"/conceitos/" + CONC_MAP[i.slug] + "/\">" + _esc(i.nome) + "</a>" : _esc(i.nome));
    return "<li>" + nm + v + (i.leitura ? " — " + _esc(i.leitura) : "") + "</li>";
  }).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "Dataset", "name": title, "description": desc, "url": canon, "inLanguage": en ? "en" : "pt-BR", "datePublished": date, "isAccessibleForFree": true, "creator": { "@type": "Organization", "name": "Radar Perene", "url": origin + "/" } }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + desc + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/diario/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/daily/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/diario/" + date + "\">" +
    "<meta property=\"og:type\" content=\"article\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + desc + "\"><meta property=\"og:image\" content=\"https://radarperene.com.br/og.png\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    _chromeCss(".ver{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem;margin:1.1rem 0}.ver b{color:var(--txt)}.ver ul{margin:.4rem 0 0}.pf{display:flex;flex-wrap:wrap;gap:14px;margin:1.1rem 0}.pf>div{flex:1 1 300px;margin:0}.cas{background:var(--surface2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem}.cas b{color:var(--txt)}.cas ul{margin:.4rem 0 0}.casl{margin:.45rem 0 .2rem;color:var(--txt2);font-size:14px}.casm{margin:.5rem 0 0;font-size:12px;color:var(--dim)}.ctx{font-size:13px;color:var(--dim);margin-top:20px}.cnav{font-size:13px;margin-top:8px;display:flex;justify-content:space-between;gap:12px}") +
    "</head><body>" + _header() + "<div class=\"wrap\">" +
    "<h1>" + (en ? "Brazil market regime — " : "Regime do mercado BR — ") + date + "</h1>" +
    "<p class=\"dt\">" + (en ? "Radar Perene daily snapshot" : "Snapshot diário do Radar Perene") + (snap.frozen === false ? " · " + (en ? "reconstructed essentials" : "essencial reconstruído") : "") + "</p>" +
    pfHtml +
    (narr.resumo && snap.frozen === false ? "<p>" + _esc(narr.resumo) + "</p>" : "") +
    "<ul>" + indHtml + "</ul>" +
    "<p class=\"ctx\">" + (en ? "Concepts: " : "Conceitos: ") + "<a href=\"/conceitos/regime-brasil/\">" + (en ? "Brazil Regime" : "Regime Brasil") + "</a> · <a href=\"/conceitos/intermercado-br/\">" + (en ? "Intermarket BR" : "Intermercado BR") + "</a> · <a href=\"/conceitos/analogos-historicos/\">" + (en ? "Historical Analogs" : "Análogos Históricos") + "</a> · " + (en ? "How to read: " : "Como ler: ") + "<a href=\"/como-ler-o-radar/\">" + (en ? "six steps" : "seis passos") + "</a> · <a href=\"/metodologia/\">" + (en ? "Methodology" : "Metodologia") + "</a></p>" +
    ((nav.prev || nav.next) ? "<p class=\"cnav\">" + (nav.prev ? "<a href=\"" + dpath + "/" + nav.prev + "\">← " + nav.prev + "</a>" : "<span></span>") + (nav.next ? "<a href=\"" + dpath + "/" + nav.next + "\">" + nav.next + " →</a>" : "<span></span>") + "</p>" : "") +
    "</div><footer><a href=\"" + dpath + "\">" + (en ? "← all daily readings" : "← todas as leituras diárias") + "</a> · <a href=\"/\">" + (en ? "full radar" : "radar completo") + "</a> · " + (en ? "Descriptive, not a forecast. Public sources." : "Descritivo, não previsão. Fontes públicas.") + "</footer>" +
    _themeScript() + _CONSENT + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
function _renderDiarioIndex(data, origin, lang) {
  const en = lang === "en";
  const itens = data.itens || [];
  const dpath = en ? "/daily" : "/diario";  // slug i18n: EN /daily, PT /diario
  const canon = origin + dpath;
  const title = en ? "Daily archive — Radar Perene" : "Arquivo diário — Radar Perene";
  const desc = en ? "Brazil's market-regime reading by Radar Perene, archived daily and citable — see what the Radar showed on each date and what followed." : "A leitura do regime do mercado brasileiro pelo Radar Perene, arquivada todo dia e citável — veja o que o Radar mostrou em cada data e o que se seguiu.";
  const rows = itens.map(function (s) {
    const rg = s.regime_score != null ? (s.regime_score + "/100" + (s.regime_label ? " · " + s.regime_label : "")) : "—";
    return "<li><a href=\"" + dpath + "/" + s.data + "\">" + s.data + "</a> — " + _esc(rg) + (s.global ? " · " + (en ? "global " : "global ") + _esc(s.global) : "") + "</li>";
  }).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": canon, "inLanguage": en ? "en" : "pt-BR", "isAccessibleForFree": true }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + _esc(desc) + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/diario\">" +
    "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/daily\">" +
    "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/diario\">" +
    "<meta property=\"og:type\" content=\"website\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:image\" content=\"https://radarperene.com.br/og.png\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    _chromeCss("p.lead{color:var(--txt2);font-size:15px}.cad{font-size:12.5px;color:var(--dim);background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:10px 13px;margin:14px 0}ul.dlist{list-style:none;padding:0}ul.dlist li{padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}ul.dlist li a{font-variant-numeric:tabular-nums;margin-right:6px}") +
    "</head><body>" + _header() + "<div class=\"wrap\"><h1>" + _esc(title) + "</h1><p class=\"lead\">" + _esc(desc) + "</p>" +
    "<p class=\"cad\">" + (en ? "Cadence: monthly (month-end) through 2026-05-30; daily (business days) from then on." : "Cadência: mensal (fim de mês) até 30/05/2026; diária (dias úteis) a partir daí.") + "</p>" +
    "<ul class=\"dlist\">" + rows + "</ul>" +
    "</div><footer><a href=\"/\">" + (en ? "← Full radar" : "← Radar completo") + "</a></footer>" + _themeScript() + _CONSENT + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

export default {
  async fetch(request, env) {
    const _url = new URL(request.url);
    const _isEN = /radarperene\.com$/i.test(_url.hostname.toLowerCase()) && !/\.com\.br$/i.test(_url.hostname.toLowerCase());
    // ── Páginas de slug COMPARTILHADO (api/docs, founder, free): o PT vive em index.html (default no .com.br), o EN em
    //    index.en.html. Sem isto, o build gerava só inglês nos 2 domínios (colisão de slug). No .com servimos a versão EN. ──
    if (_isEN) {
      const _shm = _url.pathname.match(/^\/(api\/docs|founder|free)\/?$/);
      if (_shm) {
        const _er = await env.ASSETS.fetch(new Request(_url.origin + "/" + _shm[1] + "/index.en.html"));
        if (_er.ok) return _consentRw(new HTMLRewriter()).transform(new Response(_er.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } }));
      }
      // slug i18n do arquivo diário: no .com (EN) /diario → 301 /daily (o conteúdo é o mesmo, só o slug muda; evita slug PT no domínio EN). /daily não redireciona → sem loop.
      if (/^\/diario(\/|$)/.test(_url.pathname)) {
        return Response.redirect(_url.origin + _url.pathname.replace(/^\/diario/, "/daily") + _url.search, 301);
      }
    }
    // ── /sitemap.xml — ÍNDICE de sitemaps (origin-aware): amarra os 4 filhos do MESMO domínio (páginas estáticas +
    //    ativos + indicadores + arquivo diário) num só ponto de submissão. Os diários crescem sozinhos via o filho
    //    sitemap-snapshots.xml (data-driven), então o índice reflete as centenas de URLs sem regenerar nada. ──
    if (_url.pathname === "/sitemap.xml") {
      const o = _url.origin;
      // lastmod no índice = sinal p/ o Google re-buscar os filhos. Os 3 dinâmicos (ativos/indicadores/snapshots) mudam ~diariamente;
      // o de páginas tem lastmod por-URL próprio dentro do filho → hoje no índice é inócuo (não força re-crawl de página inalterada).
      const lm = new Date().toISOString().slice(0, 10);
      const kids = ["/sitemap-pages.xml", "/sitemap-ativos.xml", "/sitemap-indicadores.xml", "/sitemap-snapshots.xml"];
      const body = '<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        kids.map(function (k) { return "<sitemap><loc>" + o + k + "</loc><lastmod>" + lm + "</lastmod></sitemap>"; }).join("") + "</sitemapindex>";
      return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
    }
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
        const _dseg = _isEN ? "/daily/" : "/diario/";  // slug i18n: EN /daily, PT /diario
        const urls = (sj.itens || []).filter(function (s) { return s && s.data; }).map(function (s) { return "<url><loc>" + _url.origin + _dseg + s.data + "</loc><changefreq>monthly</changefreq></url>"; }).join("");
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
    // ── /diario/{YYYY-MM-DD} — a foto citável congelada daquele dia + verificação do desfecho ──
    const _dm = _url.pathname.match(/^\/(?:diario|daily)\/(\d{4}-\d{2}-\d{2})$/);
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
          "<meta property=\"og:type\" content=\"website\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:image\" content=\"https://radarperene.com.br/og.png\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
          "<script type=\"application/ld+json\">" + ld + "</script>" +
          _chromeCss("p.lead{color:var(--txt2);font-size:15px}.alist a{text-decoration:none;white-space:nowrap;font-family:var(--mono);font-size:13px;line-height:2.1}") +
          "</head><body>" + _header() + "<div class=\"wrap\"><h1>" + _esc(title) + "</h1><p class=\"lead\">" + _esc(desc) + "</p><p class=\"alist\">" + links + "</p></div>" +
          "<footer><a href=\"/\">" + (en ? "&larr; Full radar" : "&larr; Radar completo") + "</a></footer>" + _themeScript() + _CONSENT + "</body></html>";
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=21600" } });
      } catch (e) { return env.ASSETS.fetch(request); }
    }
    // ── /ativo/{ticker} — página por ativo (SEO programático B.1): reusa a home shell + widget em modo ativo + narrativa per-ativo ──
    const _am = _url.pathname.match(/^\/ativo\/([a-z0-9_]{2,14})\/?$/i);  // ★ aceita underscore (us_10y, eur_usd, brk_b) — antes só [a-z0-9] barrava esses
    if (_am) {
      try {
        const tk = _am[1].toUpperCase(), tkLower = _am[1].toLowerCase();
        // ★ resolve a classe REAL (e o nome amigável) do /v1/tickers (cacheado na borda 1h) — antes hardcoded equity_br quebrava US/cripto/commodity/fx/índices
        let cls = /\d11$/.test(tk) ? "fii" : "equity_br", nomeAtivo = tk;
        try { const tr = await fetch(NARR_API.replace("/v1/narrative", "/v1/tickers"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } }); if (tr.ok) { const tj = await tr.json(); const m = tj.meta && tj.meta[tkLower]; if (m && m.classe) { cls = m.classe; nomeAtivo = m.nome || tk; } } } catch (e) {}
        const lang = _isEN ? "en" : "pt";
        const shell = await env.ASSETS.fetch(new Request(_url.origin + "/"));
        if (!(shell.headers.get("content-type") || "").includes("text/html")) return shell;
        let narr = null;
        try { const nr = await fetch(NARR_API + "?codigo=" + tk + "&classe=" + cls + "&lang=" + lang, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } }); if (nr.ok) narr = await nr.json(); } catch (e) {}
        const titulo = nomeAtivo + (lang === "en" ? " — Radar Perene · descriptive reading" : " — Radar Perene · leitura descritiva");
        const desc = (narr && narr.resumo) ? _clampDesc(narr.resumo, 148) : nomeAtivo;
        let rw = new HTMLRewriter()
          .on("title", { element(e) { e.setInnerContent(titulo); } })
          .on('meta[name="description"]', { element(e) { e.setAttribute("content", desc); } })
          .on('meta[property="og:title"]', { element(e) { e.setAttribute("content", titulo); } })
          .on('meta[property="og:description"]', { element(e) { e.setAttribute("content", desc); } })
          .on('meta[property="og:url"]', { element(e) { e.setAttribute("content", _url.origin + "/ativo/" + tk.toLowerCase()); } })
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
      if (!ct.includes("text/html")) return res; // não-HTML: intacto
      // cobertura VIVA — injeta em QUALQUER página HTML (about/sobre/metodologia/conceitos…); 1 fetch cacheado, barato
      const cob = await _fetchCobertura();
      if (!isRoot) { let rw = _consentRw(new HTMLRewriter()); if (cob) rw = _cobRewriter(rw, cob, isEN); return rw.transform(res); } // não-home: consentimento+analytics + cobertura

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
      rw = _cobRewriter(rw, cob, isEN); // cobertura viva também na home (badge/prosa com [data-cob])
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
          .on("#rp-faq-ld", { element(e) { e.setInnerContent(EN_FAQ, { html: true }); } })
          .on("#rp-graph-ld", { element(e) { e.setInnerContent(EN_GRAPH, { html: true }); } });
        // SSR-EN do BODY: traduz/preenche cada nó estático PT com o EN do catálogo (idêntico ao que o JS faz em-browser)
        for (const _id in EN_BODY) {
          const _html = EN_BODY[_id];
          rw = rw.on("#" + _id, { element(e) { e.setInnerContent(_html, { html: true }); } });
        }
        // hrefs estáticos PT que o JS troca em-browser → corrige p/ crawler EN
        rw = rw
          .on("#lng-cta", { element(e) { e.setAttribute("href", "/concepts/"); } })
          .on("#l-sobre", { element(e) { e.setAttribute("href", "/about"); } });
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
          return '<a class="ult" href="' + (isEN ? "/daily/" : "/diario/") + s.data + '"><b>' + s.data + '</b>' + _esc(rg) + (s.global ? " · " + (isEN ? "global " : "global ") + _esc(s.global) : "") + " →</a>";
        }).join("");
        rw = rw.on("#rp-ultimas", { element(e) { e.setInnerContent(uh, { html: true }); } });
      }
      return rw.transform(res);
    } catch (e) {
      return res; // nunca quebra: na dúvida, serve o original
    }
  }
};
