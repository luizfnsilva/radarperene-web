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

export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request); // serve o asset estático
    try {
      const url = new URL(request.url);
      const host = url.hostname.toLowerCase();
      const isEN = /radarperene\.com$/i.test(host) && !/\.com\.br$/i.test(host); // só .com (não .com.br)
      const isRoot = url.pathname === "/" || url.pathname === "/index.html";
      const ct = res.headers.get("content-type") || "";
      if (!isEN || !isRoot || !ct.includes("text/html")) return res; // tudo o mais: intacto
      return new HTMLRewriter()
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
        .transform(res);
    } catch (e) {
      return res; // nunca quebra: na dúvida, serve o original (PT)
    }
  }
};
