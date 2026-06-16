// Cloudflare Worker (static assets) — serve EN-static no domínio .com, inclusive p/ crawler SEM JS.
// Ambos domínios servem o MESMO index.html (PT estático). Só no .com raiz transformamos
// title/meta/OG/FAQ/lang para EN via HTMLRewriter (stream). DEFENSIVO: erro → serve o original.
// run_worker_first está escopado a "/" e "/index.html" → todo o resto serve estático (risco mínimo).

// Amostras semanais públicas (free) — datas que têm página estática /semanal/<data> (·/weekly no .com).
// Manual: o dono publica uma amostra vez ou outra p/ girar X/LinkedIn e gerar credibilidade. Para cada nova:
//   1) criar /semanal/<data>/index.html (+ /weekly/<data>/index.html EN); 2) adicionar "<data>" aqui.
// Na /diario/<data> dessas datas, visitante FREE vê um link p/ a amostra; ASSINANTE não (já recebe o semanal completo → sem duplicar).
const WEEKLY_SAMPLE_DATES = ["2026-06-12"];
const EN_TITLE = "Radar Perene — Brazil, observed and remembered";
const EN_DESC = "Brazil's market regime in 5 lenses, historical analogs and a library of precedents on public data. Today's reading, live. Descriptive, never advice.";
const EN_KEYWORDS = "market regime, country risk, Brazil macro, interest rates, Selic, intermarket, FX, equity risk premium, fair value, Brazil valuation, IFIX, REITs, IBOV, Brazilian Treasury, crypto, real estate liquidity, FipeZap, inflation, IPCA, study library, historical analogs, regulatory intelligence"; // ★ keywords PT vazavam no .com (worker não reescrevia) — espelha o EN_DESC/Dataset
const EN_FAQ = JSON.stringify({
  "@context": "https://schema.org", "@type": "FAQPage", "inLanguage": "en", "mainEntity": [
    { "@type": "Question", "name": "What time does the daily report arrive?", "acceptedAnswer": { "@type": "Answer", "text": "In your inbox ~50 minutes before the Brazilian market opens, with the prior day's close, and the summary is posted to X/LinkedIn right after. The weekly ships on Friday and the monthly on the last day of the month." } },
    { "@type": "Question", "name": "How far back does the report history go?", "acceptedAnswer": { "@type": "Answer", "text": "The subscriber library holds the enriched monthly reports since April 2010 (194 reports). The public daily snapshots go back to January 2000 (26 years), open to everyone." } },
    { "@type": "Question", "name": "How does Radar Perene compute Brazil's macro regime?", "acceptedAnswer": { "@type": "Answer", "text": "A monthly cross-market sensor outputs a Risk-BR score (0-100) from 8 domestic sub-scores (liquidity, defensive rotation, credit stress and more), calibrated on central-bank expectations (Focus since 2001) and real-rate curves (long NTN-B since 2006), isolating statistically-significant anomalies in 36-month windows." } },
    { "@type": "Question", "name": "What is the Founder price and what changes later?", "acceptedAnswer": { "@type": "Answer", "text": "US$ 149/month (or US$ 1,490/year, 2 months free), locked for your subscription while it stays active, and it includes all five Lenses and the Vertice Experiment. Later the Lenses will be sold a la carte (the Vertice alone will be US$ 290); together they exceed US$ 490/month. Founder secures them all for US$ 149. It is the same product, not a separate premium. Important: today about 90% of the functions and tickers are not available yet and roll out gradually, at no extra cost; the founder price locks your rate while everything ships." } },
    { "@type": "Question", "name": "What is free and what does Founder unlock?", "acceptedAnswer": { "@type": "Answer", "text": "The rule: free shows the readable conclusions; Founder shows the distributions and the statistical structure. On the public radar a visitor sees the regime, 5 lenses, the thesis, intermarket (3 pairs), fiscal, the BR analog summary (median and percent up), 3 Vertice thermometers, 1 divergence of the day and crypto (3 coins + Fear and Greed). Founder (US$ 149/month) unlocks lead-lag with significance (FDR), the regime scatter and breadth as a series, the full divergences and thermometers with their analog studies, crypto on-chain, and per asset the full series of returns/volatility/Sharpe, the quantile cone bands (p10-p90) and fair value/DCF/ERP. In one line: free = understand where we are; Founder = see what historically happened next, with the whole distribution." } },
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
    lead: "Five lenses, historical analogs and a library of precedents built on public data. Descriptive, not prediction.",
    cta1: "Join the 100 founders", cta2: "See the live radar", micro: "Educational content, public sources. Descriptive — never a recommendation.",
    eyb7: "Who it&rsquo;s for", s7: "Investors, analysts, managers — and serious newcomers.", s7s: "For anyone who wants to read Brazil&rsquo;s market without noise or guesswork — not the forecast, but the precedent: regimes, historical analogs and a study library of &ldquo;what happened next&rdquo;. Memory since 2000.",
    eyb2: "What it is", s2: "Five Lenses on Brazil — and one Experiment", s2s: "Not a newsletter. An instrument that reads the regime of each regulatory domain, in layers. See the structure of the five Lenses.",
    eyb5: "Depth", s5: "You choose the depth", s5s: "Each lens opens in layers — from the regime headline to the math made visible: a <b>quantile cone</b> (distribution of outcomes, never a forecast), <b>Trend Score</b> 0&ndash;10, real <b>breadth</b> (% of stocks above their 200-day average), the <b>analog study</b> (this setup happened N times → what followed) and <b>lead-lag</b>. No ceiling for those who want to go deep.",
    eyb6: "What&rsquo;s underneath",
    eybTz: "Live · now", sTz: "Today&rsquo;s reading", sTzS: "Brazil&rsquo;s regime right now — the regime, the five Lenses, today&rsquo;s divergences, the analogs and the thermometers. The full radar — intermarket, stocks, fiscal and real estate — is further below.", tzMore: "See the full radar ↓",
    eyb1: "Live · full radar", s1: "The full radar", s1s: "The complete engine over today&rsquo;s public data. History, scenarios and free cross-analysis are in the paid plan.",
    fbadge: "Launch · seats limited to the first 100 founders", fh: "The 100 founders unlock all five Lenses — and the Vértice Experiment", fp: "For US$149/mo — locked while your subscription stays active — you get the daily (~50min before the open), weekly and monthly reports by email, the library since 2010, and unlock what historically happened next: the full distribution of analogous cases per asset (probability of rising, median return and range over 3/6/12 months), the full quantile cone, a chart you can work. Plus all five Lenses and the Vértice Experiment. In the future the Lenses will be sold à la carte (Vértice alone will be US$290); together they add up to more than US$490/month. Pay upfront, 7-day full automatic refund (via Stripe), cancel in one click.",
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
    eyb8: "Free × Founder", s8: "What you unlock as a Founder", s8s: "Free shows <b>where we are</b> — today&rsquo;s regime, lenses, mood and valuation. Founder answers <b>what historically happened next</b>: the full distribution of analogous cases (probability of rising, median and range over 3/6/12 months) + the quantile cone, a working chart and all 6 Lenses (with Vértice) — plus the daily, weekly and monthly reports by email and the library since 2010. US$149/mo, locked while your subscription stays active; items marked &ldquo;coming&rdquo; arrive as the product grows.",
    eyb9: "FAQ", s9: "How it works",
    tiers: [["Today&rsquo;s reading — where we are (regime, 5 Lenses, intermarket, mood, valuation)", "✓", "✓"], ["Vértice + 3 thermometers (sample) · A×B comparisons", "✓", "✓"], ["Embeddable mini-radar (public API)", "✓", "✓"], ["Similar historical cases — that they exist and how many", "✓", "✓"], ["Daily report by email — ~50min before the BR open", "—", "✓ now"], ["Weekly (Friday) + monthly report", "—", "✓ now"], ["Report library — monthly reports since April 2010", "—", "✓ now"], ["What historically happened next — probability of rising, median and range (3/6/12m)", "—", "✓ now"], ["Full quantile cone (p10–p90) + overlaid analogs", "—", "✓ now"], ["Vértice in depth — lead-lag, regime scatter, breadth, analog studies", "—", "✓ now"], ["Work the chart — free-range zoom, compare A×B, overlays", "—", "✓ now"], ["Price locked while your subscription stays active · a seat among the 100", "—", "✓ now"], ["All 6 Lenses — including the Vértice Experiment", "—", "guaranteed"], ["Long history + anomalies + regime-turn alerts", "—", "coming"], ["3 L3 reads — economist, lawyer, accountant", "—", "coming"]],
    faq: [["What time does the daily report arrive?", "In your inbox ~50 minutes before the Brazilian market opens, with the prior day&rsquo;s close — and the summary is posted to X/LinkedIn right after. The weekly ships on Friday and the monthly on the last day of the month."], ["How far back does the report history go?", "The subscriber library holds the enriched monthly reports since April 2010 (194 reports). The public daily snapshots go back to January 2000 (26 years), open to everyone."], ["How does Radar Perene compute Brazil&rsquo;s macro regime?", "A monthly cross-market sensor outputs a Risk-BR score (0–100) from 8 domestic sub-scores (liquidity, defensive rotation, credit stress and more), calibrated on central-bank expectations (Focus since 2001) and real-rate curves (long NTN-B since 2006), isolating statistically-significant anomalies in 36-month windows."], ["What is the Founder price and what changes later?", "US$ 149/month (or US$ 1,490/year · 2 months free), locked for your subscription while it stays active — and it includes all five Lenses and the Vértice Experiment. In the future the Lenses will be sold à la carte (Vértice alone will be US$290); together they exceed US$490/month. Founder secures them all for US$ 149. You join the preliminary product now and get full access when it is ready — the same product, not a separate premium. Important: today about 90% of the functions and tickers aren&rsquo;t available yet and roll out gradually, at no extra cost; you pay the (locked) founder price to secure everything as it ships, not for a complete product today."], ["How do payment and the 7-day window work?", "Payment is taken at signup (R$ on the .com.br domain, US$ on .com), processed by Stripe. You have a 7-day full, automatic refund window — a legal right, no friction. After 7 days the normal recurrence (monthly or annual) continues. Everything is managed by you in the Stripe Customer Portal — there is no human support desk."], ["How do support, cancellation and data deletion work?", "ALL subscription management — cancellation, refunds, card changes and invoices — is 100% self-service via the Stripe Customer Portal, anytime, in one click. There is no human support desk: you handle everything yourself, in the portal. Account and data deletion is also one click in your profile — we store nothing beyond your Google/Apple login and email."], ["Is this investment advice?", "No. Under our P7 protocol the system is strictly descriptive — it reads regimes and anomalies from public sources and never recommends, predicts a price, or gives financial advice."], ["Does Radar Perene make forecasts?", "No. Radar Perene does not predict a price or a point. It works with precedents, historical distributions and probabilities — describing what tended to follow similar environments, with the uncertainty band on display."], ["How do the studies work?", "Each Library study answers one question: what historically happened next when ___? — risk-on/off extreme, extreme pessimism/optimism, strong/weak dollar, Selic hiking/cutting cycle. The answer is the IBOV&rsquo;s empirical distribution over 3/6/12 months (median, % up, and the 50% and 80% bands)."], ["Does the Radar learn?", "Yes — through memory, self-evaluation and historical accumulation, not by rewriting the past. Past readings are confronted with the actual outcome 3/6/12 months later."], ["What are historical analogs?", "Past episodes historically similar to today&rsquo;s environment. Not a forecast — a distribution map: what happened next, with sample size and uncertainty shown."], ["What is the Study Library?", "A collection of editorial objects built from conditional events — regimes, sentiment, liquidity and rates. Each is a citable study: the Radar has a study for that."]]
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
    "eyb-tz": C.eybTz, "s-tz": C.sTz, "s-tz-s": C.sTzS, "tz-more": C.tzMore,
    "eyb1": C.eyb1, "s1": C.s1, "s1s": C.s1s,
    "fbadge": C.fbadge, "fh": C.fh, "fp": C.fp, "wl-btn": C.wlbtn, "assine-link": "See everything that lands in your inbox — and the plans →",
    "eyb-ult": "Latest readings", "s-ult": "The day's regime — archived and auditable", "s-ult-s": "The Radar publishes the day's regime daily. Each entry is brief, dated and verifiable — the full history crosses past and future.", "ult-cta": "See the full Diary →",
    "eyb3": C.eyb3, "s3": C.s3, "s3s": C.s3s, "eyb4": C.eyb4, "disc": C.disc,
    "eyb9": C.eyb9, "s9": C.s9, "qtag-txt": "CURRENT SIGNAL · REGIME BR",
    "lenses": lenses, "topnav": topnav, "conceitos-grid": cgrid, "ladder": ladder, "scale": scale, "princ": princ, "tiers": tiers, "faqbox": faqbox, "ftnav": C.ftnav
  };
})();

// JSON-LD @graph (Organization/WebSite/Dataset/Service) em EN p/ o .com (o JS NÃO traduz este graph).
const EN_GRAPH = JSON.stringify({
  "@context": "https://schema.org", "@graph": [
    { "@type": "Organization", "@id": "https://radarperene.com/#org", "name": "Radar Perene", "alternateName": "Método Perene", "url": "https://radarperene.com", "email": "hello@radarperene.com", "logo": "https://radarperene.com/avatar-square-800.png", "image": "https://radarperene.com/og-image-1200x630.png", "description": "A historical observer and library of precedents for the Brazilian market — descriptive, in-house, public-source. It reads regimes (Brazil, global, intermarket), 5 lenses and 3 proprietary indices (Perene Risk, Ânima and ILI · Real Estate Liquidity Index); covers 400+ assets and series (Brazil, US, crypto, world, real estate by city, inflation, Brazilian Treasury) on one template; offers historical analogs, asset comparisons, a Study Library (\"what happened next when…\") and 3/6/12-month outcome self-evaluation. Memory since 2000. It does not predict price; not investment advice.", "knowsLanguage": ["en", "pt-BR"], "areaServed": { "@type": "Country", "name": "Brazil" }, "sameAs": ["https://radarperene.com.br"] },
    { "@type": "WebSite", "@id": "https://radarperene.com/#website", "url": "https://radarperene.com", "name": "Radar Perene", "publisher": { "@id": "https://radarperene.com/#org" }, "inLanguage": ["en", "pt-BR"], "potentialAction": { "@type": "SearchAction", "target": { "@type": "EntryPoint", "urlTemplate": "https://radarperene.com/?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
    { "@type": "Dataset", "@id": "https://radarperene.com/#dataset", "name": "Radar Perene — Brazil market regime, macro and intermarket", "description": "Descriptive series and scores of the market regime, rates/Selic, country risk, intermarket, FX, REITs (IFIX), Treasury, crypto, the equity risk premium (earnings yield vs real rate), real estate (FipeZap by city, ILI · Real Estate Liquidity Index) and inflation (IPCA/IGP-M/INCC/SINAPI), plus regulatory/judicial activity. Public data since 2000, continuously updated. Descriptive, never a recommendation or price forecast.", "url": "https://radarperene.com/", "creator": { "@id": "https://radarperene.com/#org" }, "isAccessibleForFree": true, "license": "https://radarperene.com/", "inLanguage": ["en", "pt-BR"], "spatialCoverage": { "@type": "Place", "name": "Brazil" }, "temporalCoverage": "2000-01-01/..", "keywords": ["market regime", "country risk", "Brazil macro", "interest rates", "Selic", "intermarket", "FX", "equity risk premium", "fair value", "IFIX", "REITs", "IBOV", "Brazilian Treasury", "Brazil valuation", "real estate liquidity", "ILI", "FipeZap", "price per square meter", "inflation", "IPCA", "study library", "historical analogs", "asset comparisons", "self-evaluation", "historical distributions", "market precedents", "conditional events", "what happened next"], "variableMeasured": ["regime_br_score", "risk_global_score", "equity risk premium", "fair value", "intermarket", "analog-case distribution (3/6/12m)", "median and p10-p90 bands"], "distribution": { "@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": "https://radarperene.com/INTEGRACAO_RADAR.md" } },
    { "@type": "Service", "@id": "https://radarperene.com/#service", "name": "Radar Perene Founder", "serviceType": "Reports and descriptive market intelligence", "provider": { "@id": "https://radarperene.com/#org" }, "areaServed": { "@type": "Country", "name": "Brazil" }, "description": "Email reports — a daily ~50 minutes before the Brazilian market opens (prior-day close), a weekly (Friday) and a monthly — plus the library of monthly reports since April 2010, long history, workable charts (free-range zoom, compare A×B, overlays and indicators), p10–p90 scenario cone, fair value and regime-turn alerts. Founder pricing for the first 100. Descriptive, never a recommendation.", "offers": { "@type": "Offer", "price": "149", "priceCurrency": "USD", "availability": "https://schema.org/LimitedAvailability", "url": "https://radarperene.com/subscribe" }, "hasOfferCatalog": { "@type": "OfferCatalog", "name": "Report cadences", "itemListElement": [{ "@type": "OfferCatalog", "name": "Daily (~50min before the BR open)" }, { "@type": "OfferCatalog", "name": "Weekly (Friday)" }, { "@type": "OfferCatalog", "name": "Monthly (last day of the month)" }] } }
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
  const upstream = _apiUpstream(sub, _url.search);
  const auth = request.headers.get("Authorization") || "";
  const apikey = request.headers.get("apikey") || NARR_ANON;
  const isAnon = !auth || auth === "Bearer " + NARR_ANON;
  try {
    // GET anon = a esmagadora maioria do tráfego (free + embed) → cacheável na borda. Chave = sub+query ENCODADA (sem ? & = soltos).
    if (request.method === "GET" && isAnon) {
      const body = await _cachedText(upstream, "api-" + encodeURIComponent(sub + _url.search), 900);
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
const _CONSENT = '<div id="rp-cookie" style="display:none;position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#13171c;border-top:1px solid #222a31;padding:14px 18px;font:13px/1.5 \'Inter\',system-ui,sans-serif;color:#e8ebee"><div style="max-width:1080px;margin:0 auto;display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center"><span id="rp-ck-txt" style="flex:1;min-width:240px;color:#8b97a3">Usamos cookies de medição (analytics) para melhorar o site. Você escolhe — sem isso, nada é rastreado.</span><button id="rp-ck-no" style="background:transparent;border:1px solid #222a31;color:#e8ebee;padding:9px 16px;border-radius:8px;font-weight:600;cursor:pointer">Recusar</button><button id="rp-ck-yes" style="background:#c9a227;border:0;color:#0a0c0f;padding:9px 18px;border-radius:8px;font-weight:700;cursor:pointer">Aceitar</button></div></div>' +
  '<script>(function(){var EN=/radarperene\\.com$/i.test(location.hostname)&&!/\\.com\\.br$/i.test(location.hostname);if(EN){var t=document.getElementById("rp-ck-txt");if(t)t.textContent="We use measurement (analytics) cookies to improve the site. Your choice — nothing is tracked without it.";document.getElementById("rp-ck-no").textContent="Decline";document.getElementById("rp-ck-yes").textContent="Accept";}var KEY="rp-consent";window.rpTrack=function(name){if(localStorage.getItem(KEY)!=="granted")return;try{if(window.gtag)gtag("event",name);}catch(e){}};function loadAhrefs(){var AH=/\\.com\\.br$/i.test(location.hostname)?"4LbsuoMGfXN4azVzHW6wPQ":"m9HGU5S9vnFEBS9K4J62rg";var sa=document.createElement("script");sa.async=1;sa.src="https://analytics.ahrefs.com/analytics.js";sa.setAttribute("data-key",AH);document.head.appendChild(sa);}loadAhrefs();function loadAnalytics(){var GA=/\\.com\\.br$/i.test(location.hostname)?"G-4LVGNLRV9L":"G-CWB77T178R";var s=document.createElement("script");s.async=1;s.src="https://www.googletagmanager.com/gtag/js?id="+GA;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag("js",new Date());gtag("config",GA);}var c=localStorage.getItem(KEY),bar=document.getElementById("rp-cookie");if(c==="granted"){loadAnalytics();}else if(c!=="denied"){bar.style.display="block";}document.getElementById("rp-ck-yes").onclick=function(){localStorage.setItem(KEY,"granted");bar.style.display="none";loadAnalytics();};document.getElementById("rp-ck-no").onclick=function(){localStorage.setItem(KEY,"denied");bar.style.display="none";};})();<\/script>';
function _consentRw(rw) { return rw.on("body", { element(e) { e.append(_CONSENT, { html: true }); } }); }
// ── slug i18n do arquivo diário NO .com (EN): reescreve qualquer link /diario… → /daily… ANTES de servir, em vez de
//    deixar o 301 /diario→/daily atuar no clique. O Ahrefs marca "Page has links to redirect" quando uma página
//    LINKA p/ uma URL que redireciona — então o link tem de já apontar p/ o destino final. SEMPRE gated por isEN no
//    chamador (no .com.br /diario é 200, não se toca). /daily não redireciona → sem loop. HTMLRewriter = streaming, custo ~0.
function _enDailyRw(rw) { return rw.on('a[href^="/diario"]', { element(e) { const h = e.getAttribute("href"); if (h) e.setAttribute("href", h.replace(/^\/diario/, "/daily")); } }); }

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
    '.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--txt)}.brand .nm{font-family:var(--serif);font-size:17px;font-weight:600}.brand .nm b{color:var(--gold)}.brand .logo-w{display:block;height:31px;width:auto}:root[data-theme="dark"] .logo-w-light{display:none}:root:not([data-theme="dark"]) .logo-w-dark{display:none}' +
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
  return '<div class="top"><a class="brand" href="/"><img class="logo-w logo-w-light" src="/logo-light.svg" alt="Radar Perene" width="123" height="31"><img class="logo-w logo-w-dark" src="/logo-dark.svg" alt="Radar Perene" width="123" height="31"></a><button class="tg" id="rp-tg" type="button" aria-label="tema">☾</button></div>';
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
    "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + _esc(title) + "</title>" +
    "<meta name=\"description\" content=\"" + desc + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<meta property=\"og:type\" content=\"website\">" +
    "<meta property=\"og:title\" content=\"" + _esc(title) + "\">" +
    "<meta property=\"og:description\" content=\"" + desc + "\">" +
    "<meta property=\"og:url\" content=\"" + canon + "\">" +
    "<meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
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
  return _fetchT(url, { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 3600, cacheEverything: true } });
}
// ── Bloco do ASSINANTE na página /diario/<data> (client-side): para Founder logado, busca
//    /v1/biblioteca/item?tipo=diario&data=<date> com o Bearer da sessão e revela a prosa abaixo
//    dos números (server-rendered). Anon/free → gancho + CTA. DEFENSIVO: try/catch — se o script
//    falhar, a página numérica (já no HTML) fica intacta. A página é edge-cacheada; o conteúdo
//    gateado vem por fetch per-user (não cacheado), casando com o Vary:Authorization do edge.
function _memoGate(date, hasWeekly) {
  const J = JSON.stringify;
  // #rp-weekly: banner client-side p/ a amostra semanal FREE (/semanal/<data> ·/weekly no .com). Só aparece
  //   p/ visitante NÃO-assinante (assinante recebe o semanal completo → não duplica). Default oculto; revelado
  //   por JS conforme o status da sessão (mesma detecção do memo: corpo_md no /v1/biblioteca/item ⇒ assinante).
  return '<div id="rp-weekly" class="wsamplebox" style="display:none"></div>' +
    '<div id="rp-memo" class="memo"></div>' +
    '<script src="/vendor/supabase-js/supabase.min.js"></script>' +
    '<script>(function(){if(!window.supabase)return;' +
    'var box=document.getElementById("rp-memo");if(!box)return;' +
    'var EN=/radarperene\\.com$/i.test(location.hostname)&&!/\\.com\\.br$/i.test(location.hostname);' +
    'var ANON=' + J(NARR_ANON) + ',DATE=' + J(date) + ',HASW=' + (hasWeekly ? "true" : "false") + ';' +
    'function showW(){if(!HASW)return;var w=document.getElementById("rp-weekly");if(!w)return;var u=(EN?"/weekly/":"/semanal/")+DATE+"/";w.innerHTML=\'<a class="wsample" href="\'+u+\'"><span class="wt">\'+(EN?"Weekly report \\u00b7 free sample":"Relat\\u00f3rio semanal \\u00b7 amostra aberta")+\'</span><span class="wd">\'+(EN?"The week on one page \\u2014 read the free sample \\u2192":"A semana em uma p\\u00e1gina \\u2014 leia a amostra gratuita \\u2192")+\'</span></a>\';w.style.display="block";}' +
    'function hideW(){var w=document.getElementById("rp-weekly");if(w)w.style.display="none";}' +
    'var sb=window.supabase.createClient("https://zcjtkgltrxdnlacezpny.supabase.co",ANON,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"implicit"}});' +
    'function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}' +
    'function inl(s){return esc(s).replace(/\\*\\*([^*]+)\\*\\*/g,"<strong>$1</strong>").replace(/(^|[^*])\\*([^*]+)\\*/g,"$1<em>$2</em>").replace(/&lt;sub&gt;/g,"<span class=\\"selo\\">").replace(/&lt;\\/sub&gt;/g,"</span>");}' +
    'function md(t){var bs=String(t||"").replace(/\\r/g,"").split(/\\n{2,}/),o=[];bs.forEach(function(b){b=b.trim();if(!b)return;if(/^#{1,3}\\s/.test(b)){var h=b.match(/^#+/)[0].length;o.push("<h"+h+">"+inl(b.replace(/^#+\\s/,""))+"</h"+h+">");return;}if(/^---+$/.test(b)){o.push("<hr>");return;}var ls=b.split("\\n");if(ls.every(function(l){return /^[-*]\\s/.test(l.trim());})){o.push("<ul>"+ls.map(function(l){return "<li>"+inl(l.replace(/^[-*]\\s/,""))+"</li>";}).join("")+"</ul>");return;}o.push("<p>"+ls.map(inl).join("<br>")+"</p>");});return o.join("");}' +
    'function gancho(){box.innerHTML=\'<div class="memogate"><div class="gh">\'+(EN?"The full reading is for subscribers":"A leitura completa \\u00e9 para assinantes")+\'</div><p>\'+(EN?"Daily, weekly and monthly reports \\u2014 subscribers only.":"Relat\\u00f3rios di\\u00e1rios, semanais e mensais \\u2014 exclusivos para assinantes.")+\'</p><div class="ghb"><a class="btn2" href="https://buy.stripe.com/5kQ6oG3Iu40bem7asvb3q01" target="_blank" rel="noopener">\'+(EN?"Founder \\u00b7 US$149/mo":"Founder \\u00b7 R$149/m\\u00eas")+\'</a> <a href="#" id="rp-login" class="lg">\'+(EN?"Already a subscriber? Sign in":"J\\u00e1 \\u00e9 assinante? Entrar")+\'</a></div></div>\';var lg=document.getElementById("rp-login");if(lg)lg.onclick=function(e){e.preventDefault();sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.href}});};}' +
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
  const _rl = regime ? (regime.classificacao || regime.leitura || "") : "", _rs = (regime && regime.valor != null) ? regime.valor + "/100" : "";
  const _pulse = [perene && perene.valor != null ? (en ? "Perene Risk " : "Risco Perene ") + perene.valor + "/100" : null,
    anima && anima.valor != null ? "Ânima " + anima.valor + "/100" : null].filter(Boolean).join(" · ");
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
  const pfHtml = casHtml || "";
  const IND_OK = { "regime-br": 1, "erp-br": 1, "valuation-br": 1, "ciclicas-defensivas": 1, "ibovespa": 1, "analogo-br": 1 };  // slugs com página /indicador real
  const CONC_MAP = { "regime-global": "regime-global", "intermercado-br": "intermercado-br" };  // reconstruídos → página de conceito (não /indicador, que 404ava)
  const _indLi = function (i) {
    const v = i.valor != null ? " <b>" + _esc(_fmtVal(i.valor, i.unidade)) + "</b>" : "";
    const nm = IND_OK[i.slug] ? "<a href=\"/indicador/" + _esc(i.slug) + "\">" + _esc(i.nome) + "</a>" : (CONC_MAP[i.slug] ? "<a href=\"/conceitos/" + CONC_MAP[i.slug] + "/\">" + _esc(i.nome) + "</a>" : _esc(i.nome));
    return "<li>" + nm + v + (i.leitura ? " — " + _esc(i.leitura) : "") + "</li>";
  };
  // item 30: o regime SAI da lista diária → bloco próprio "Contexto do mês", rotulado mensal (+ ref. quando o snapshot traz)
  const indHtml = inds.filter(function (i) { return i.slug !== "regime-br"; }).map(_indLi).join("");
  const mancheteHtml = _pulse ? "<p class=\"manch\">" + (en ? "Today’s pulse — " : "O pulso do dia — ") + "<b>" + _esc(_pulse) + "</b>" + (en ? " · proprietary daily indices (change every business day)" : " · índices proprietários diários (mudam a cada dia útil)") + "</p>" : "";
  const ctxHtml = regime ? "<div class=\"mctx\"><b>" + (en ? "Month context — BR regime (monthly" : "Contexto do mês — regime BR (mensal") + (refMes ? " · ref. " + _esc(refMes) : "") + ")</b><ul>" + _indLi(regime) + "</ul><p class=\"casm\">" + (en ? "Monthly by construction — the score only moves at month-end; the daily variation lives in the indices above." : "Mensal por construção — o score só se move no fecho do mês; a variação diária está nos índices acima.") + "</p></div>" : "";
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "Dataset", "name": title, "description": desc, "url": canon, "inLanguage": en ? "en" : "pt-BR", "datePublished": date, "dateModified": date, "isAccessibleForFree": true, "creator": { "@type": "Organization", "name": "Radar Perene", "url": origin + "/" } }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + desc + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/diario/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/daily/" + date + "\">" +
    "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/diario/" + date + "\">" +
    "<meta property=\"og:type\" content=\"article\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + desc + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    "<script type=\"application/ld+json\">" + JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [ { "@type": "ListItem", "position": 1, "name": en ? "Home" : "Início", "item": origin + "/" }, { "@type": "ListItem", "position": 2, "name": en ? "Daily archive" : "Arquivo diário", "item": origin + dpath }, { "@type": "ListItem", "position": 3, "name": date, "item": canon } ] }).replace(/</g, "\\u003c") + "</script>" +
    _chromeCss(".ver{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem;margin:1.1rem 0}.ver b{color:var(--txt)}.ver ul{margin:.4rem 0 0}.pf{display:flex;flex-wrap:wrap;gap:14px;margin:1.1rem 0}.pf>div{flex:1 1 300px;margin:0}.cas{background:var(--surface2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem}.cas b{color:var(--txt)}.cas ul{margin:.4rem 0 0}.casl{margin:.45rem 0 .2rem;color:var(--txt2);font-size:14px}.casm{margin:.5rem 0 0;font-size:12px;color:var(--dim)}.ctx{font-size:13px;color:var(--dim);margin-top:20px}.cnav{font-size:13px;margin-top:8px;display:flex;justify-content:space-between;gap:12px}.manch{font-family:var(--serif);font-size:21px;line-height:1.45;color:var(--txt);margin:.7rem 0 1.1rem}.manch b{color:var(--gold)}.panh{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:1.3rem 0 .3rem}.mctx{background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:.7rem 1rem;margin:1rem 0}.mctx>b{font-size:13px;color:var(--dim);letter-spacing:.04em}.mctx ul{margin:.35rem 0 0;padding-left:1.1rem}.memo{margin:1.3rem 0}.memohd{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:.5rem}.memobody{color:var(--txt2);font-size:16px;line-height:1.7;max-width:66ch}.memobody h1{font-family:var(--serif);font-weight:500;font-size:21px;color:var(--txt);margin:.4rem 0 .5rem}.memobody h2{font-family:var(--serif);font-weight:500;font-size:18px;color:var(--txt);margin:1.3rem 0 .4rem}.memobody h3{font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--gold);margin:1.2rem 0 .35rem}.memobody p{margin:0 0 .75rem}.memobody ul{margin:0 0 .75rem}.memobody hr{border:0;border-top:1px solid var(--line);margin:1.2rem 0}.memobody em{color:var(--dim)}.memobody .selo{display:block;font-size:12px;color:var(--dim);margin-top:.3rem}.memogate{background:var(--surface);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:1rem 1.1rem}.memogate .gh{font-family:var(--serif);font-size:18px;color:var(--txt);margin-bottom:.3rem}.memogate p{margin:0 0 .7rem;color:var(--dim);font-size:14px}.memogate .ghb{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.btn2{display:inline-block;background:var(--gold);color:#0a0c0f;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:600;text-decoration:none}.memogate .lg{font-size:13px;color:var(--dim)}.wsamplebox{margin:1.3rem 0}.wsample{display:block;background:var(--surface2);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:0 9px 9px 0;padding:.8rem 1rem;text-decoration:none}.wsample:hover{border-color:var(--gold)}.wsample .wt{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:.25rem}.wsample .wd{display:block;color:var(--txt2);font-size:15px}.memotabs{display:flex;flex-wrap:wrap;gap:8px;margin:.2rem 0 1rem}.memotab{background:var(--surface2);border:1px solid var(--line);color:var(--txt2);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.memotab:hover{border-color:var(--gold)}.memotab.on{background:var(--gold);color:#0a0c0f;border-color:var(--gold)}.memohd2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:.5rem}.memografs{margin:1.1rem 0;display:grid;gap:12px}.memograf{width:100%;max-width:520px;border:1px solid var(--line);border-radius:8px;display:block}") +
    "</head><body>" + _header() + "<div class=\"wrap\">" +
    "<h1>" + (en ? "Brazil market regime — " : "Regime do mercado BR — ") + date + "</h1>" +
    "<p class=\"dt\">" + (en ? "Radar Perene daily snapshot" : "Snapshot diário do Radar Perene") + (snap.frozen === false ? " · " + (en ? "reconstructed essentials" : "essencial reconstruído") : "") + "</p>" +
    mancheteHtml +
    (narr.resumo && snap.frozen === false ? "<p>" + _esc(narr.resumo) + "</p>" : "") +
    (indHtml ? "<p class=\"panh\">" + (en ? "Today’s snapshot" : "O panorama do dia") + "</p><ul>" + indHtml + "</ul>" : "") +
    pfHtml +
    ctxHtml +
    _memoGate(date, WEEKLY_SAMPLE_DATES.indexOf(date) >= 0) +
    "<p class=\"ctx\">" + (en ? "Concepts: " : "Conceitos: ") + "<a href=\"/conceitos/regime-brasil/\">" + (en ? "Brazil Regime" : "Regime Brasil") + "</a> · <a href=\"/conceitos/intermercado-br/\">" + (en ? "Intermarket BR" : "Intermercado BR") + "</a> · <a href=\"/conceitos/analogos-historicos/\">" + (en ? "Historical Analogs" : "Análogos Históricos") + "</a> · " + (en ? "How to read: " : "Como ler: ") + "<a href=\"/como-ler-o-radar/\">" + (en ? "six steps" : "seis passos") + "</a> · <a href=\"/metodologia/\">" + (en ? "Methodology" : "Metodologia") + "</a> · <a href=\"" + (en ? "/track-record" : "/historico") + "\">" + (en ? "Track record" : "Track record") + "</a></p>" +
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
  // ★ item 30 (opção 2): a linha lidera com o que VARIA por dia (intermercado global); o regime BR — mensal por
  //   construção — vem rotulado "(mensal)" p/ o número repetido dentro do mês não ler como "sistema parado".
  //   (Perene/Ânima por dia ainda não vêm neste payload de índice — pedido registrado p/ o backend; dentro de cada
  //   dia a manchete diária já existe.)
  const rows = itens.map(function (s) {
    const rg = s.regime_score != null ? (s.regime_score + "/100" + (s.regime_label ? " · " + s.regime_label : "")) : "—";
    // 30b: a linha PULSA — Perene/Ânima mudam todo dia útil (vêm do /v1/snapshots); regime mensal fica como cauda rotulada
    const dia = [s.perene != null ? (en ? "Perene Risk " : "Perene ") + "<b>" + s.perene + "</b>" : null,
      s.anima != null ? "Ânima <b>" + s.anima + "</b>" : null,
      s.global ? (en ? "global " : "global ") + _esc(s.global) : null].filter(Boolean).join(" · ");
    return "<li><a href=\"" + dpath + "/" + s.data + "\">" + s.data + "</a>" + (dia ? " — " + dia : "") + " · <span class=\"mn\">" + (en ? "month regime (monthly): " : "regime do mês (mensal): ") + _esc(rg) + "</span></li>";
  }).join("");
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": title, "url": canon, "inLanguage": en ? "en" : "pt-BR", "isAccessibleForFree": true }).replace(/</g, "\\u003c");
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + _esc(desc) + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/diario\">" +
    "<link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/daily\">" +
    "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/diario\">" +
    "<meta property=\"og:type\" content=\"website\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    _chromeCss("p.lead{color:var(--txt2);font-size:15px}.cad{font-size:12.5px;color:var(--dim);background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:10px 13px;margin:14px 0}ul.dlist{list-style:none;padding:0}ul.dlist li{padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}ul.dlist li a{font-variant-numeric:tabular-nums;margin-right:6px}ul.dlist .mn{color:var(--dim)}") +
    "</head><body>" + _header() + "<div class=\"wrap\"><h1>" + _esc(title) + "</h1><p class=\"lead\">" + _esc(desc) + "</p>" +
    "<p class=\"cad\">" + (en ? "Cadence: monthly (month-end) through 2026-05-30; daily (business days) from then on. The BR regime score is monthly by construction — it only moves at month-end, so it repeats within a month; the daily variation (Perene Risk Index, Ânima, intermarket) lives inside each day’s page." : "Cadência: mensal (fim de mês) até 30/05/2026; diária (dias úteis) a partir daí. O score do regime BR é mensal por construção — só se move no fecho do mês, então repete dentro do mês; a variação diária (Índice de Risco Perene, Ânima, intermercado) está dentro da página de cada dia.") + "</p>" +
    "<ul class=\"dlist\">" + rows + "</ul>" +
    "</div><footer><a href=\"/\">" + (en ? "← Full radar" : "← Radar completo") + "</a></footer>" + _themeScript() + _CONSENT + "</body></html>";
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
  const html = "<!doctype html><html lang=\"" + (en ? "en" : "pt-BR") + "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + _esc(title) + "</title><meta name=\"description\" content=\"" + _esc(desc) + "\">" +
    "<link rel=\"canonical\" href=\"" + canon + "\">" +
    "<link rel=\"alternate\" hreflang=\"pt-br\" href=\"https://radarperene.com.br/historico\"><link rel=\"alternate\" hreflang=\"en\" href=\"https://radarperene.com/track-record\"><link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/historico\">" +
    "<meta property=\"og:type\" content=\"website\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
    "<script type=\"application/ld+json\">" + ld + "</script>" +
    _chromeCss("p.lead{color:var(--txt2);font-size:15px}.hl{font-family:var(--serif);font-size:20px;line-height:1.45;color:var(--txt);margin:.6rem 0 1.1rem}.hl b{color:var(--gold)}table.trk{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}table.trk th{text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);padding:6px 8px}table.trk td{padding:7px 8px;border-bottom:1px solid var(--line)}table.trk td.n,table.trk th.n{text-align:right}.ok{color:#15a05a;font-weight:600}.no{color:var(--dim)}.ctx{font-size:13px;color:var(--dim);margin-top:18px}") +
    "</head><body>" + _header() + "<div class=\"wrap\"><h1>" + _esc(title.replace(" — Radar Perene", "")) + "</h1><p class=\"lead\">" + _esc(desc) + "</p>" +
    "<p class=\"hl\">" + headline + "</p>" +
    (rows ? "<table class=\"trk\"><thead><tr>" + thead + "</tr></thead><tbody>" + rows + "</tbody></table>" : "") +
    "<p class=\"ctx\">" + (en ? "Distribution/outcome observed, never a forecast or recommendation. Each reading is frozen on its date; the outcome matures ~6 months later. " : "Distribuição/desfecho observado, nunca previsão ou recomendação. Cada leitura é congelada na sua data; o desfecho matura ~6 meses depois. ") +
    "<a href=\"" + ddp + "\">" + (en ? "All daily readings" : "Todas as leituras diárias") + "</a> · <a href=\"/conceitos/analogos-historicos/\">" + (en ? "Historical Analogs" : "Análogos Históricos") + "</a> · <a href=\"/metodologia/\">" + (en ? "Methodology" : "Metodologia") + "</a></p>" +
    "</div><footer><a href=\"/\">" + (en ? "← Full radar" : "← Radar completo") + "</a></footer>" + _themeScript() + _CONSENT + "</body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

export default {
  async fetch(request, env, ctx) {
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
    // ── Páginas de slug COMPARTILHADO (api/docs, founder, free): o PT vive em index.html (default no .com.br), o EN em
    //    index.en.html. Sem isto, o build gerava só inglês nos 2 domínios (colisão de slug). No .com servimos a versão EN. ──
    if (_isEN) {
      const _shm = _url.pathname.match(/^\/(api\/docs|founder|free|widgets)\/?$/);
      if (_shm) {
        const _er = await env.ASSETS.fetch(new Request(_url.origin + "/" + _shm[1] + "/index.en.html"));
        if (_er.ok) return _enDailyRw(_consentRw(new HTMLRewriter())).transform(new Response(_er.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } }));
      }
      // slug i18n do arquivo diário: no .com (EN) /diario → 301 /daily (o conteúdo é o mesmo, só o slug muda; evita slug PT no domínio EN). /daily não redireciona → sem loop.
      if (/^\/diario(\/|$)/.test(_url.pathname)) {
        return Response.redirect(_url.origin + _url.pathname.replace(/^\/diario/, "/daily") + _url.search, 301);
      }
      // landing de assinatura: slug i18n /assine (PT) ↔ /subscribe (EN). No .com (EN) /assine → 301 /subscribe (slug PT não vive no domínio EN). /subscribe não redireciona aqui → sem loop.
      if (/^\/assine(\/|$)/.test(_url.pathname)) {
        return Response.redirect(_url.origin + _url.pathname.replace(/^\/assine/, "/subscribe") + _url.search, 301);
      }
    }
    // contraparte PT: no .com.br /subscribe → 301 /assine (mantém o slug EN fora do domínio PT). Gate por host (não !_isEN) p/ não redirecionar em dev/localhost, onde os 2 arquivos servem direto.
    if (/\.com\.br$/i.test(_url.hostname) && /^\/subscribe(\/|$)/.test(_url.pathname)) {
      return Response.redirect(_url.origin + _url.pathname.replace(/^\/subscribe/, "/assine") + _url.search, 301);
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
        const tr = await _fetchT(NARR_API.replace("/v1/narrative", "/v1/tickers"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 21600, cacheEverything: true } });
        const tj = tr.ok ? await tr.json() : { ativos: [] };
        // ★ lastmod POR URL = última data de dado do ativo (meta[t].ultima, matview diária no edge) — freshness
        //   honesto: série parada (ex.: FIPEZAP mensal) não finge mudança diária; série viva sinaliza re-crawl.
        const urls = (tj.ativos || []).map(function (t) { var u = tj.meta && tj.meta[t] && tj.meta[t].ultima; return "<url><loc>" + _url.origin + "/ativo/" + t + "</loc>" + (u ? "<lastmod>" + u + "</lastmod>" : "") + "<changefreq>daily</changefreq></url>"; }).join("");
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>", { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=21600" } });
      } catch (e) { return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', { headers: { "content-type": "application/xml" } }); }
    }
    // ── /sitemap-indicadores.xml — sitemap programático de /indicador (DATA-DRIVEN): lista REAL via /v1/indicadores ──
    if (_url.pathname === "/sitemap-indicadores.xml") {
      try {
        const ir = await _fetchIndicadores(_isEN ? "en" : "pt");
        const ij = ir.ok ? await ir.json() : { indicadores: [] };
        const _ilm = ij.data_referencia ? "<lastmod>" + ij.data_referencia + "</lastmod>" : "";  // lastmod = data da leitura do catálogo (todas mudam juntas no pulso diário)
        const urls = (ij.indicadores || []).filter(function (i) { return i && i.slug; }).map(function (i) { return "<url><loc>" + _url.origin + "/indicador/" + encodeURIComponent(i.slug) + "</loc>" + _ilm + "<changefreq>daily</changefreq></url>"; }).join("");
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
        try { const sl = await _diarioFetch(SNAPS_API); if (sl.ok) { const ds = ((await sl.json()).itens || []).map(function (x) { return x.data; }); const ix = ds.indexOf(_dm[1]); if (ix >= 0) { nav.next = ix > 0 ? ds[ix - 1] : null; nav.prev = ix < ds.length - 1 ? ds[ix + 1] : null; } } } catch (e) { /* opcional */ }
        return _renderDiarioDia(await r.json(), _dm[1], _url.origin, _isEN ? "en" : "pt", nav);
      } catch (e) { return env.ASSETS.fetch(request); }
    }
    // ── /ativos — hub crawlável que DE-ORFANIZA as páginas /ativo (Ahrefs #3): links reais via /v1/tickers. 1 rota, língua por hostname. ──
    if (_url.pathname === "/ativos") {
      try {
        const en = _isEN;
        const tr = await _fetchT(NARR_API.replace("/v1/narrative", "/v1/tickers"), { headers: { apikey: NARR_ANON, Authorization: "Bearer " + NARR_ANON }, cf: { cacheTtl: 21600, cacheEverything: true } });
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
          "<link rel=\"alternate\" hreflang=\"x-default\" href=\"https://radarperene.com.br/ativos\">" +
          "<meta property=\"og:type\" content=\"website\"><meta property=\"og:url\" content=\"" + canon + "\"><meta property=\"og:title\" content=\"" + _esc(title) + "\"><meta property=\"og:description\" content=\"" + _esc(desc) + "\"><meta property=\"og:locale\" content=\"" + (en ? "en_US" : "pt_BR") + "\"><meta property=\"og:image\" content=\"" + _url.origin + (en ? "/og-image-1200x630-en.png" : "/og-image-1200x630.png") + "\"><meta name=\"twitter:card\" content=\"summary_large_image\">" +
          "<script type=\"application/ld+json\">" + ld + "</script>" +
          _chromeCss("p.lead{color:var(--txt2);font-size:15px}.alist a{text-decoration:none;white-space:nowrap;font-family:var(--mono);font-size:13px;line-height:2.1}") +
          "</head><body>" + _header() + "<div class=\"wrap\"><h1>" + _esc(title) + "</h1><p class=\"lead\">" + _esc(desc) + "</p><p class=\"alist\">" + links + "</p></div>" +
          "<footer><a href=\"/\">" + (en ? "&larr; Full radar" : "&larr; Radar completo") + "</a></footer>" + _themeScript() + _CONSENT + "</body></html>";
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=21600" } });
      } catch (e) { return env.ASSETS.fetch(request); }
    }
    // ── /ativo/{ticker} — página por ativo (SEO programático B.1): reusa a home shell + widget em modo ativo + narrativa per-ativo ──
    const _am = _url.pathname.match(/^\/ativo\/([a-z0-9_-]{2,44})\/?$/i);  // ★ aceita underscore (us_10y) E hífen+slug longo (fipezap_sp_res_venda 20c, tesouro-prefixado-com-juros-semestrais-01012031 44c) — {2,14} barrava o catálogo total 2026-06-11
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
        if (_isEN) rw = _enDailyRw(rw); // /ativo herda a nav da home shell → /diario→/daily no .com
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
      if (!ct.includes("text/html")) return res; // não-HTML: intacto
      // cobertura VIVA — injeta em QUALQUER página HTML (about/sobre/metodologia/conceitos…); 1 fetch cacheado, barato
      const cob = await _fetchCobertura();
      if (!isRoot) { let rw = _consentRw(new HTMLRewriter()); if (cob) rw = _cobRewriter(rw, cob, isEN); if (isEN) rw = _enDailyRw(rw); const _t = rw.transform(res); const _h = new Headers(_t.headers); _h.set("content-type", "text/html; charset=utf-8"); return new Response(_t.body, { status: _t.status, headers: _h }); } // não-home: consentimento+analytics + cobertura (+ /diario→/daily no .com). charset EXPLÍCITO: o ASSETS serve "text/html" pelado e webviews (X/LinkedIn in-app) BAIXAM html sem charset em vez de abrir.

      // ★ digest do dia (home payload) inlinado no HTML → o teaser/radar pintam SEM o round-trip cliente (~2-4s, o
      //   gargalo do time-to-insight). Token-agnóstico (handler /v1/digest ignora Authorization) → serve anon+Founder
      //   idêntico, moat intacto. cacheTtl 1800 (muda 1×/dia no pulso) mantém quente. Concorrente com narr/ultimas.
      const _lk = isEN ? "en" : "pt";
      // ── B: edge-cache da home RENDERIZADA + SWR (Cache API). O HTML é anon-idêntico por host+lang (digest é
      //    token-agnóstico; o Founder muda só client-side) → seguro cachear. Corta SSR+awaits por request; o digest
      //    muda ~1×/dia, logo 120s fresco + stale 24h (revalida em bg via ctx.waitUntil) é folgado. Chave = host+lang.
      //    NÃO usa o cf-cache (resposta de Worker não é cacheada por header) — daí o Cache API explícito, como _cachedText.
      const _hcache = caches.default, _hk = "https://rp-home.internal/v2/" + host + "/" + _lk; // /v2/ versiona a chave (v1→v2: canonical por host no HTML cru; busta stale antigo)
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
      try { const uj = await _ultP; if (uj) ultimas = (uj.itens || []).slice(0, 3); } catch (e) { /* opcional */ }

      let rw = new HTMLRewriter();
      rw = _cobRewriter(rw, cob, isEN); // cobertura viva também na home (badge/prosa com [data-cob])
      // canonical/og:url da home POR HOST no HTML cru: o index.html estático nasce com ".com" fixo e só o JS
      //   corrigia em runtime — crawler sem JS (Bing 1ª passada, bots de IA) via o .com.br se declarar duplicata
      //   do .com, contradizendo o hreflang pt-br. O renderizado já era self-referente (radar.js); agora o cru também é.
      rw = rw
        .on("link#rp-canonical", { element(e) { e.setAttribute("href", url.origin + "/"); } })
        .on('meta[property="og:url"]', { element(e) { e.setAttribute("content", url.origin + "/"); } });
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
          .on('meta[property="og:image"]', { element(e) { e.setAttribute("content", "https://radarperene.com/og-image-1200x630-en.png"); } })  // OG em inglês no .com (era a PT herdada do index)
          .on('meta[name="twitter:image"]', { element(e) { e.setAttribute("content", "https://radarperene.com/og-image-1200x630-en.png"); } })
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
          .on("#api-embed", { element(e) { e.setInnerContent('<iframe src="https://radarperene.com/radar-embed" width="100%" height="1400" style="border:0"></iframe>'); } });
        rw = _enDailyRw(rw); // nav/footer/CTA do arquivo diário no .com → /daily (evita 301)
      } else if (_gdt) {
        // PT: o graph estático vive no index.html → data o Dataset via BUFFER do texto inline (chunks do
        //   HTMLRewriter podem partir a âncora no meio; acumula tudo e emite 1× no último chunk).
        let _gbuf = "";
        rw = rw.on("#rp-graph-ld", { text(t) { _gbuf += t.text; t.remove(); if (t.lastInTextNode) t.replace(_graphDated(_gbuf, _gdt), { html: true }); } });
      }
      if (narr && narr.texto_html) {
        rw = rw.on("#rp-narrative", { element(e) { e.setInnerContent(narr.texto_html, { html: true }); } });
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
        const uh = ultimas.map(function (s) {
          const rg = s.regime_score != null ? (s.regime_score + "/100" + (s.regime_label ? " · " + s.regime_label : "")) : "—";
          const dia = [s.perene != null ? (isEN ? "Perene Risk " : "Perene ") + s.perene : null,
            s.anima != null ? "Ânima " + s.anima : null,
            s.global ? "global " + _esc(s.global) : null].filter(Boolean).join(" · ");
          const mes = (isEN ? "month regime (monthly): " : "regime do mês (mensal): ") + _esc(rg);
          return '<a class="ult" href="' + (isEN ? "/daily/" : "/diario/") + s.data + '"><b>' + s.data + '</b>' + (dia ? dia + ' · <span style="color:var(--dim)">' + mes + "</span>" : _esc(rg) + (s.global ? " · global " + _esc(s.global) : "")) + " →</a>";
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
