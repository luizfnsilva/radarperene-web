#!/usr/bin/env node
// Gerador das páginas de conteúdo — parseia SITE_COPY_BURST_1.md + SITE_COPY_BURST_2_CONCEITOS.md
// (fontes verbatim do ghostwriter) e emite páginas estáticas bilíngues reusando o chrome do index.html.
// Doutrina: 1 rota por página (slug PT), conteúdo pt+en embutido, língua escolhida por hostname (.com→en, .com.br→pt).
// SEO: páginas-diretório (metodologia/, free/, lentes/*/, conceitos/*/) são servidas pelo Cloudflare COM trailing slash
//      (a forma sem barra 307-redireciona) → canonical/hreflang/sitemap/links internos TODOS com barra final,
//      senão o canonical aponta pro redirect e a página se deindexa (Ahrefs #1/#2). /sobre e /about são arquivos → sem barra.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = dirname(new URL(import.meta.url).pathname);
const RR = join(ROOT, "..", "RADAR-REGULATORIO");
const burst = (name) => {  // procura na raiz do RR, depois em _review_screenshots; ausente → "" (gerador pula as páginas dessa fonte, preservando o HTML existente)
  for (const p of [join(RR, name), join(RR, "_review_screenshots", name)]) if (existsSync(p)) return readFileSync(p, "utf8");
  console.log(`  ⚠ fonte ausente: ${name} — páginas dessa fonte serão PULADAS (HTML preservado)`);
  return "";
};
const COPY1 = burst("SITE_COPY_BURST_1.md");
const COPY2 = burst("SITE_COPY_BURST_2_CONCEITOS.md");
const COPY3 = burst("SITE_COPY_BURST_3_COMPLEMENTOS.md");   // home "linguagem"/"últimas leituras", /conceitos umbrella, diário, founder
const COPY4 = burst("SITE_COPY_BURST_4_METODOLOGIA.md");    // /metodologia v3 — "mãe das citações" (substitui Burst1§5/Burst2§2)
const COPY5 = burst("SITE_COPY_BURST_5_OPERACIONAIS.md");   // /termos, /privacidade, /api/docs, /founder
const INDEX = readFileSync(join(ROOT, "index.html"), "utf8");

// chrome compartilhado: o <link rel=preconnect…> até </head> do index, p/ casar fontes/tema/estilo 100%
const headStyle = INDEX.slice(INDEX.indexOf("<link rel=\"preconnect\""), INDEX.indexOf("</head>"));

// ─────────────────────────────────────────────────────────────────────────────
// PAGES: cada entrada referencia a fonte (1=Burst1, 2=Burst2) e as chaves [pt,en].
// type só afeta o breadcrumb. metodologia agora vem do Burst2 §2 (versão pondered, sem pesos expostos).
// ─────────────────────────────────────────────────────────────────────────────
const PAGES = [
  // ── Burst 4: metodologia v3 (mãe das citações) ──
  { slug: "metodologia",           src: 4, sec: ["m_pt", "m_en"], type: "metodo" },
  // ── Burst 2 (conceitual) ──
  { slug: "como-ler-o-radar",      src: 2, sec: ["1.1", "1.2"], type: "guia" },
  { slug: "lentes",                src: 2, sec: ["3.1", "3.2"], type: "lentes" },
  // ── Burst 3: umbrella de conceitos ──
  { slug: "conceitos",             src: 3, sec: ["1.3", "1.4"], type: "umbrella-conceitos" },
  { slug: "conceitos/regime-brasil",                  src: 2, sec: ["4.1:pt", "4.1:en"], type: "conceito" },
  { slug: "conceitos/regime-global",                  src: 2, sec: ["4.2:pt", "4.2:en"], type: "conceito" },
  { slug: "conceitos/intermercado-br",                src: 2, sec: ["4.3:pt", "4.3:en"], type: "conceito" },
  { slug: "conceitos/erp-br",                         src: 2, sec: ["4.4:pt", "4.4:en"], type: "conceito" },
  { slug: "conceitos/cone-de-regressao-logaritmica",  src: 2, sec: ["4.5:pt", "4.5:en"], type: "conceito" },
  { slug: "conceitos/indice-anima",                   src: 2, sec: ["4.6:pt", "4.6:en"], type: "conceito" },
  { slug: "conceitos/risk-on-risk-off",               src: 2, sec: ["4.7:pt", "4.7:en"], type: "conceito" },
  { slug: "conceitos/analogos-historicos",            src: 2, sec: ["4.8:pt", "4.8:en"], type: "conceito" },
  { slug: "conceitos/vertice",                        src: 2, sec: ["4.9:pt", "4.9:en"], type: "conceito" },
  // ── Burst 1 (lentes individuais + free) ──
  { slug: "free",                 src: 1, sec: ["4.1", "4.2"], type: "free" },
  { slug: "lentes/patrimonial",   src: 1, sec: ["3.1", "3.2"], type: "lente" , noindex: true },   // 2026-06-29: noindex,follow — lente regulatória órfã (0 artigos), fora do funil R$29
  { slug: "lentes/eleitoral",     src: 1, sec: ["3.3", "3.4"], type: "lente" , noindex: true },   // 2026-06-29: noindex,follow — lente regulatória órfã (0 artigos), fora do funil R$29
  { slug: "lentes/macro",         src: 1, sec: ["3.5", "3.6"], type: "lente" },
  { slug: "lentes/institucional", src: 1, sec: ["3.7", "3.8"], type: "lente" , noindex: true },   // 2026-06-29: noindex,follow — lente regulatória órfã (0 artigos), fora do funil R$29
  { slug: "lentes/imobiliaria",   src: 1, sec: ["3.9", "3.10"], type: "lente" , noindex: true },   // 2026-06-29: noindex,follow — lente regulatória órfã (0 artigos), fora do funil R$29
  { slug: "lentes/vertice",       src: 1, sec: ["3.11", "3.12"], type: "lente" },
  // ── Burst 5: páginas operacionais ──
  // ★ 2026-06-29: /termos SAIU do gerador — é hand-written (peça jurídica; BURST_5 §1 ainda tem R$149/100-contas, regen reverteria). Fica no sitemap via HANDWRITTEN_SITEMAP.
  { slug: "privacidade",   src: 5, sec: ["2.1", "2.2"], type: "legal" },
  { slug: "api/docs",      src: 5, sec: ["3.1", "3.2"], type: "apidocs" },
  // ★ 2026-06-29: /founder SAIU do gerador — é hand-written institucional (founder/index.html|.en.html).
  //   Mantê-la aqui faria um regen reverter p/ a landing de venda R$149/100-contas. NÃO reintroduzir.
  { slug: "widgets",       src: 5, sec: ["6.1", "6.2"], type: "apidocs" },  // catálogo de embeds <radar-perene> (slug PT==EN → index.en.html + rota no worker)
];

// ─── SEO_OVERRIDE: title ≤ 60c, description ≤ 158c. Ajusta SÓ os metas (knobs de SEO), preservando
//     keywords; o H1 e o corpo continuam verbatim do ghostwriter. Só as páginas que estouravam o limite. ───
const SEO_OVERRIDE = {
  // ★ 2026-06-29: descrições ≤150 que fecham o pensamento (antes o clampD(150) cortava a desc-fonte mid-frase → meta/DefinedTerm truncados, ruim p/ AEO/GEO).
  "como-ler-o-radar": { tPt: "Como ler o Radar Perene — seis passos para o regime do dia" },
  "metodologia": { tPt: "Metodologia do Radar Perene — regime e percentil histórico", tEn: "Radar Perene methodology — regime & historical percentile", dPt: "Como o Radar Perene lê o mercado brasileiro: regime, intermercado, valuation, sentimento, análogos. Método declarado e auditável — sem previsão, sem parecer." },
  "conceitos": { tPt: "A linguagem do Radar — todos os conceitos do Radar Perene", tEn: "The Radar's language — every Radar Perene concept" },
  "termos": { dPt: "Termos de uso do Radar Perene: serviço, camadas Free e Perene Semanal, pagamento e reembolso, API pública, propriedade intelectual e responsabilidade." },
  "privacidade": { dEn: "Radar Perene privacy policy: data collected (Google/Apple login, email), how it is used, your LGPD/GDPR rights, retention and one-click deletion." },
  "api/docs": { dPt: "Endpoint JSON público da Leitura do dia e widget embedável do Radar Perene. Sem cadastro, sem chave de API. Schema, exemplos curl e código de embed." },
  "lentes": { tPt: "As cinco lentes do Radar Perene e a Lente Vértice", tEn: "Radar Perene's five lenses (and Lente Vértice)", dPt: "Cinco lentes leem o regime do mercado brasileiro por dimensão — macro/monetária, patrimonial, institucional, imobiliária, eleitoral. A Lente Vértice é o experimento cross-domínio." },
  "conceitos/regime-brasil": { tPt: "Regime Brasil — como o Radar lê o mercado brasileiro", tEn: "Brazil Regime — how the Radar reads Brazil's market", dPt: "Regime Brasil é a leitura agregada do mercado brasileiro em uma janela definida — defensivo, neutro ou pró-risco, com escala 0–100 auxiliar.", dEn: "Brazil Regime: the aggregate reading of the Brazilian market — defensive, neutral, or pro-risk. Categorical, with a 0–100 auxiliary scale." },
  "conceitos/regime-global": { dPt: "Regime Global é a leitura agregada do ambiente externo que pressiona o Brasil — volatilidade, dólar, juros longos americanos e câmbio." },
  "conceitos/analogos-historicos": { dPt: "Análogos Históricos: janelas do passado com perfil de regime semelhante ao atual e o que se seguiu — distribuição, não previsão." },
  "conceitos/intermercado-br": { tPt: "Intermercado BR — razões patrimoniais como regime", dPt: "Intermercado BR: leitura cruzada de razões patrimoniais brasileiras (finanças, utilities, commodities, FIIs, café/ouro). Camada paralela às lentes.", dEn: "Intermarket BR: cross-reading of Brazilian wealth-sector ratios (finance, utilities, commodities, REITs, coffee/gold). A layer parallel to the lenses." },
  "conceitos/cone-de-regressao-logaritmica": { tPt: "Cone de Regressão Logarítmica — assimetria de valuation", tEn: "Logarithmic Regression Cone — valuation asymmetry" },
  "conceitos/indice-anima": { tPt: "Índice Ânima — leitura de humor do mercado brasileiro" },
  "conceitos/risk-on-risk-off": { tPt: "Índice de Risco Perene — apetite ao risco no Brasil", tEn: "Perene Risk Index — Brazil's market risk-appetite gauge", dPt: "O Índice de Risco Perene mede o apetite a risco do mercado brasileiro numa escala 0–100, com sinais de virada datados e validados.", dEn: "The Perene Risk Index measures Brazil's market risk appetite on a 0–100 scale, with dated, validated turning-point signals." },
  "conceitos/vertice": { tPt: "Vértice — hipóteses cross-domínio e atualização bayesiana", tEn: "Vértice — cross-domain hypotheses & Bayesian updating", dPt: "A Lente Vértice é o observatório cross-asset do Radar — sistema bayesiano que formula hipóteses com evidências e contradições à mostra.", dEn: "Vértice is the Radar's methodological experiment — a Bayesian system formulating cross-domain hypotheses with evidence and continuous calibration." },
  "lentes/patrimonial": { tPt: "Lente Patrimonial — regime tributário e sucessório do Brasil", tEn: "Wealth Lens — Brazil's estate tax, holding & offshore regime", dPt: "Trajetória regulatória do ITCMD, holding familiar, Lei 14.754, sucessão e proteção patrimonial — em código probabilístico, com convergência de fontes.", dEn: "Regulatory trajectory of ITCMD, family holdings, Law 14.754, succession, and asset protection — read in probabilistic code, with source convergence." },
  "lentes/eleitoral": { tPt: "Lente Eleitoral — calendário regulatório-eleitoral do Brasil" },
  "lentes/macro": { dPt: "Política monetária, câmbio, mercado de capitais, regulação bancária, crédito e fiscal — em código probabilístico, cruzados com o Intermercado BR.", dEn: "Monetary policy, FX, capital markets, banking regulation, credit, and fiscal — read in probabilistic code and crossed with Brazil's intermarket." },
  "lentes/institucional": { tPt: "Lente Institucional — compliance, LGPD e jurisprudência", tEn: "Institutional Lens — compliance, LGPD & case law in Brazil" },
  "lentes/imobiliaria": { tPt: "Lente Imobiliária — regulação, FIIs, crédito e SINAPI", tEn: "Real Estate Lens — Brazil's property regulation & REITs" },
  "lentes/vertice": { tPt: "Lente Vértice — hipóteses cross-domínio e bayesianismo", tEn: "Lente Vértice — cross-domain hypotheses & Bayesianism" },
};

// ─── parser: extrai cada bloco fenced. Chaveia por "N.M" e, quando há sublíngua (#### pt-BR / heading com pt-BR|EN), também "N.M:pt"/"N.M:en". ───
function parseBlocks(md) {
  const out = {};
  const lines = md.split("\n");
  let key = null, lang = null, inFence = false, buf = [];
  for (const ln of lines) {
    if (!inFence) {
      if (/^##\s/.test(ln)) { key = null; lang = null; continue; }  // cabeçalho nível-2 (## N.) reseta o contexto → fences soltos (§5 microcópia, §6) NÃO poluem a última página
      const h3 = ln.match(/^###\s+(\d+\.\d+)\b/);
      if (h3) { key = h3[1]; lang = /\bpt-?br\b/i.test(ln) ? "pt" : (/\bEN\b/.test(ln) ? "en" : null); continue; }
      const h4 = ln.match(/^####\s+(pt-?br|en)\b/i);
      if (h4) { lang = /pt/i.test(h4[1]) ? "pt" : "en"; continue; }
    }
    if (ln.trim().startsWith("```")) {
      if (inFence) { if (key) { const v = buf.join("\n"); out[key] = v; if (lang) out[key + ":" + lang] = v; } buf = []; inFence = false; }
      else if (key) { inFence = true; buf = []; }
      continue;
    }
    if (inFence) buf.push(ln);
  }
  return out;
}
// Burst 4 (metodologia v3) usa "## 1. pt-BR" / "## 2. EN" (nível-2) + 1 fence cada → extrai os fences em ordem
function fencedBlocks(md) {
  const out = []; let inF = false, buf = [];
  for (const ln of md.split("\n")) {
    if (ln.trim().startsWith("```")) { if (inF) { out.push(buf.join("\n")); buf = []; inF = false; } else { inF = true; buf = []; } continue; }
    if (inF) buf.push(ln);
  }
  return out;
}
const MET4 = fencedBlocks(COPY4);  // [0]=pt, [1]=en
// extrai o conteúdo bruto de uma seção "### key" (até o próximo ###/##), removendo o wrapper ``` externo.
// usado p/ /api/docs (Burst 5 §3), que tem fences ``` ANINHADOS (GET/JSON/iframe) — parseBlocks por toggle quebraria.
function sectionRaw(md, key) {
  const lines = md.split("\n");
  let i = lines.findIndex((l) => new RegExp("^###\\s+" + key.replace(".", "\\.") + "\\b").test(l));
  if (i < 0) return "";
  const buf = []; i++;
  for (; i < lines.length; i++) { if (/^###?\s/.test(lines[i])) break; buf.push(lines[i]); }
  let s = 0, e = buf.length - 1;
  while (s < buf.length && buf[s].trim() === "") s++;
  while (e > s && buf[e].trim() === "") e--;
  if (buf[s] && buf[s].trim().startsWith("```")) s++;          // tira o ``` de abertura do wrapper da página
  if (buf[e] && buf[e].trim().startsWith("```")) e--;          // tira o ``` de fechamento
  return buf.slice(s, e + 1).join("\n");
}
const B5 = parseBlocks(COPY5);
B5["3.1"] = sectionRaw(COPY5, "3.1"); B5["3.2"] = sectionRaw(COPY5, "3.2");  // api/docs: override (fences aninhados)
B5["6.1"] = sectionRaw(COPY5, "6.1"); B5["6.2"] = sectionRaw(COPY5, "6.2");  // /widgets: override (snippets <radar-perene> em fences aninhados; §6 — §5 é "notas do dev")
const BLOCKS = { 1: parseBlocks(COPY1), 2: parseBlocks(COPY2), 3: parseBlocks(COPY3), 4: { "m_pt": MET4[0] || "", "m_en": MET4[1] || "" }, 5: B5 };

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// normaliza um path interno: EN→PT slug + trailing slash p/ rotas-diretório (evita link→redirect). /sobre,/about,/ativo,#âncoras intactos.
const SLUG_MAP = [
  ["/how-to-read-the-radar", "/como-ler-o-radar"],
  ["/methodology", "/metodologia"],
  ["/concepts/regime-brazil", "/conceitos/regime-brasil"],
  ["/concepts/intermarket-br", "/conceitos/intermercado-br"],
  ["/concepts/logarithmic-regression-cone", "/conceitos/cone-de-regressao-logaritmica"],
  ["/concepts/anima-index", "/conceitos/indice-anima"],
  ["/concepts/historical-analogs", "/conceitos/analogos-historicos"],
  ["/conceitos/intermarket-doctrine", "/conceitos/intermercado-br"], ["/concepts/intermarket-doctrine", "/conceitos/intermercado-br"],
  ["/conceitos/market-regime", "/conceitos/regime-brasil"], ["/concepts/market-regime", "/conceitos/regime-brasil"],
  ["/concepts/", "/conceitos/"],
  ["/lenses/wealth", "/lentes/patrimonial"],
  ["/lenses/electoral", "/lentes/eleitoral"],
  ["/lenses/institutional", "/lentes/institucional"],
  ["/lenses/real-estate", "/lentes/imobiliaria"],
  ["/lenses/", "/lentes/"],
  ["/lenses", "/lentes"],
  ["/about", "/sobre"],
  ["/api/todays-reading.json", "/api/leitura-do-dia.json"],  // endpoint público (1 rota, rótulo EN diferente na copy)
  ["/diary", "/diario"],
  ["/terms", "/termos"],
  ["/privacy", "/privacidade"],
  ["#integrity", "#integridade"],
];
function normPath(url) {
  for (const [en, pt] of SLUG_MAP) url = url.split(en).join(pt);
  // trailing slash p/ rotas-diretório internas (não p/ arquivos /sobre /about, /ativo, âncoras, externos)
  if (url.startsWith("/") && !url.includes("#") && url !== "/" && url !== "/sobre" && url !== "/about" && !url.startsWith("/ativo") && url !== "/assine" && url !== "/subscribe" && !/\.[a-z0-9]+$/i.test(url)) {
    if (!url.endsWith("/")) url += "/";  // rotas-diretório → barra; arquivos (.json/.xml) ficam intactos
  }
  return url;
}
// paths internos válidos (após normPath) → links p/ inexistentes viram TEXTO (mata 404 de conceito/lente citados na copy)
const VALID_PATHS = new Set(["/", "/sobre", "/about", "/diario", "/diario/", "/ativos", "/api/leitura-do-dia.json", "/assine", "/subscribe", "/termos/", "/terms/", "/conceitos/indice-de-liquidez-imobiliaria/", "/concepts/real-estate-liquidity-index/", ...PAGES.map((p) => "/" + p.slug + "/")]);
const OK_PREFIX = ["/ativo/", "/indicador/", "/diario/", "/artigos/", "/articles/"];  // rotas dinâmicas do worker (não enumeráveis) — permite por prefixo
function validInternal(p) {
  if (!p.startsWith("/") || p.includes("#") || /\.[a-z0-9]+$/i.test(p)) return true;  // âncora/arquivo/externo → não mexe
  if (VALID_PATHS.has(p)) return true;
  return OK_PREFIX.some((pre) => p.startsWith(pre) && p.length > pre.length);
}
// ── EN: slugs em inglês p/ o .com (PAGE_MAP). Arquivo PT usa slugs PT; arquivo EN usa slugs EN. ──
const EN_SLUG = {
  "metodologia": "methodology", "como-ler-o-radar": "how-to-read-the-radar", "lentes": "lenses", "conceitos": "concepts",
  "conceitos/regime-brasil": "concepts/regime-brazil", "conceitos/regime-global": "concepts/regime-global", "conceitos/intermercado-br": "concepts/intermarket-br",
  "conceitos/erp-br": "concepts/erp-br", "conceitos/cone-de-regressao-logaritmica": "concepts/logarithmic-regression-cone", "conceitos/indice-anima": "concepts/anima-index",
  "conceitos/risk-on-risk-off": "concepts/risk-on-risk-off", "conceitos/analogos-historicos": "concepts/historical-analogs", "conceitos/vertice": "concepts/vertice",
  "free": "free", "lentes/patrimonial": "lenses/wealth", "lentes/eleitoral": "lenses/electoral", "lentes/macro": "lenses/macro", "lentes/institucional": "lenses/institutional",
  "lentes/imobiliaria": "lenses/real-estate", "lentes/vertice": "lenses/vertice", "termos": "terms", "privacidade": "privacy", "api/docs": "api/docs", "founder": "founder",
};
const enSlug = (s) => EN_SLUG[s] || s;
const SLUG_MAP_EN = [["/api/todays-reading.json", "/api/leitura-do-dia.json"], ["/diary", "/diario"]];  // arquivo EN: rotas-worker PT-only; o resto mantém o slug EN da copy
function normPathEN(url) {
  for (const [a, b] of SLUG_MAP_EN) url = url.split(a).join(b);
  if (url.startsWith("/") && !url.includes("#") && url !== "/" && url !== "/sobre" && url !== "/about" && !url.startsWith("/ativo") && url !== "/assine" && url !== "/subscribe" && !/\.[a-z0-9]+$/i.test(url)) { if (!url.endsWith("/")) url += "/"; }
  return url;
}
const VALID_PATHS_EN = new Set(["/", "/about", "/sobre", "/diario", "/diario/", "/ativos", "/api/leitura-do-dia.json", "/assine", "/subscribe", "/termos/", "/terms/", "/conceitos/indice-de-liquidez-imobiliaria/", "/concepts/real-estate-liquidity-index/", ...PAGES.map((p) => "/" + enSlug(p.slug) + "/")]);
function validInternalEN(p) {
  if (!p.startsWith("/") || p.includes("#") || /\.[a-z0-9]+$/i.test(p)) return true;
  if (VALID_PATHS_EN.has(p)) return true;
  return OK_PREFIX.some((pre) => p.startsWith(pre) && p.length > pre.length);
}
let CUR_LANG = "pt";  // page() seta antes de cada renderBlock → mdInline escolhe a normalização (PT mapeia EN→PT; EN mantém EN)
// inline markdown: [txt](url) + **bold** + *itálico* (após esc; os marcadores sobrevivem ao esc)
function mdInline(s) {
  const np = CUR_LANG === "en" ? normPathEN : normPath, vi = CUR_LANG === "en" ? validInternalEN : validInternal;
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => { const p = np(url.trim()); return vi(p) ? `<a href="${p}">${txt}</a>` : txt; })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
}

// ─── renderBlock: bloco fenced (com marcadores <!-- … -->) → {title,desc,h1,bodyHtml,disclaimer}.
//     Suporta tabelas markdown, blockquotes, listas ordenadas/não, H2/H3, e parágrafos de prosa. ───
function renderBlock(raw) {
  const lines = raw.split("\n");
  let title = "", desc = "", h1 = "", disclaimer = "";
  const body = [];
  let i = 0, para = [];
  const flush = () => { if (para.length) { body.push(`<p>${para.map(mdInline).join(" ")}</p>`); para = []; } };
  const peekContent = () => { let j = i; while (j < lines.length && (lines[j].trim() === "" || /^<!--/.test(lines[j].trim()))) j++; return j; };

  for (i = 0; i < lines.length;) {
    const ln = lines[i];
    const t = ln.trim();

    // bloco de código ``` … ``` (api/docs: GET, JSON de response, iframe) → <pre> indexável
    if (t.startsWith("```")) {
      flush(); i++; const code = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++;  // consome o ``` de fechamento
      if (code.length) body.push(`<pre class="api"><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }

    // marcadores de comentário
    const cm = t.match(/^<!--\s*(.*?)\s*-->$/);
    if (cm) {
      const tag = cm[1].toLowerCase(); i++;
      const grab = () => { const j = peekContent(); i = j; return j < lines.length ? lines[i++].trim() : ""; };
      if (tag.startsWith("meta title")) { flush(); title = grab(); }
      else if (tag.startsWith("meta desc")) { flush(); desc = grab(); }
      else if (tag === "h1") { flush(); h1 = grab(); }
      else if (tag.startsWith("h2")) { flush(); const idm = cm[1].match(/id="([^"]+)"/); body.push(`<h2 class="sec"${idm ? ` id="${idm[1]}"` : ""}>${esc(grab())}</h2>`); }
      else if (tag.startsWith("h3")) { flush(); body.push(`<h3 class="sub">${esc(grab())}</h3>`); }
      else if (tag.startsWith("disclaimer")) { flush(); const d = []; const j = peekContent(); i = j; while (i < lines.length && lines[i].trim() && !/^<!--/.test(lines[i].trim())) d.push(lines[i++].trim()); disclaimer = d.join(" "); }
      else if (tag.startsWith("cta")) { flush(); const c = grab(); if (c) body.push(/\[[^\]]+\]\(/.test(c) ? `<p class="ctarow rel">${mdInline(c)}</p>` : `<p class="ctarow"><a class="btn" href="/assine">${esc(c)}</a></p>`); }
      else if (tag.includes("microcopy") || tag.includes("link")) { flush(); const lk = grab(); if (lk) body.push(`<p class="rel">${mdInline(lk)}</p>`); }
      else if (tag.includes("fechamento") || tag.includes("closing") || tag.includes("canôn") || tag.includes("canon")) { flush(); const c = grab(); if (c) body.push(`<p class="closing">${mdInline(c)}</p>`); }
      // demais comentários: ignora o rótulo
      continue;
    }

    // tabela markdown: linhas consecutivas começando com "|"
    if (t.startsWith("|")) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i].trim()); i++; }
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const isSep = (r) => /^\|?[\s:|-]+\|?$/.test(r) && r.includes("-");
      let html = '<table class="tb"><thead><tr>';
      const head = cells(rows[0]);
      html += head.map((c) => `<th>${mdInline(c)}</th>`).join("") + "</tr></thead><tbody>";
      for (let r = 1; r < rows.length; r++) { if (isSep(rows[r])) continue; html += "<tr>" + cells(rows[r]).map((c) => `<td>${mdInline(c)}</td>`).join("") + "</tr>"; }
      html += "</tbody></table>";
      body.push(html);
      continue;
    }

    // blockquote: linha(s) começando com ">"
    if (t.startsWith(">")) {
      flush();
      const q = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) { q.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      body.push(`<blockquote class="ex">${q.filter(Boolean).map(mdInline).join("<br>")}</blockquote>`);
      continue;
    }

    // lista ordenada
    if (/^\d+\.\s/.test(t)) {
      flush();
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s/, "")); i++; }
      body.push("<ol>" + items.map((x) => `<li>${mdInline(x)}</li>`).join("") + "</ol>");
      continue;
    }

    // lista não-ordenada ("- " ou "• ")
    if (/^[-•]\s/.test(t)) {
      flush();
      const items = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-•]\s/, "")); i++; }
      body.push("<ul>" + items.map((x) => `<li>${mdInline(x)}</li>`).join("") + "</ul>");
      continue;
    }

    i++;
    if (t === "") { flush(); continue; }
    if (/^(-{3,}|\*{3,})$/.test(t)) { flush(); body.push('<hr style="border:0;border-top:1px solid var(--line);max-width:90px;margin:34px 0 26px">'); continue; }   // regra horizontal markdown → <hr> estilizado
    // linha de estado-ao-vivo do engine: [Label: {x}] · …
    if (/^\[.+\]/.test(t) && t.includes("{")) { flush(); body.push(`<p class="livestate">${esc(t.replace(/\{[^}]*\}/g, "—"))}</p>`); continue; }
    if (/^GET\s+https?:\/\//.test(t) || t.startsWith("<iframe")) { flush(); body.push(`<pre class="api"><code>${esc(t)}</code></pre>`); continue; }
    para.push(t);
  }
  flush();
  return { title, desc, h1, bodyHtml: body.join("\n"), disclaimer };
}

function crumbLabel(slug, L) {
  if (slug.startsWith("lentes/")) return (L ? "lens " : "lente ") + slug.split("/")[1];
  if (slug.startsWith("conceitos/")) return (L ? "concept" : "conceito");
  return slug;
}

// ─── JSON-LD por tipo de página (briefing §3) — Organization (todas) + BreadcrumbList (profundidade≥2) + específico do tipo. Lang-aware: PT→.com.br, EN→.com. ───
const ORG_BR = "https://radarperene.com.br";
const SITE_LASTMOD = "2026-06-04";
function breadcrumbSchema(slug, h1, org) {
  const segs = slug.split("/"); const items = [{ "@type": "ListItem", position: 1, name: "Início", item: org + "/" }]; let acc = "";
  segs.forEach((s, i) => { acc += "/" + s; items.push({ "@type": "ListItem", position: i + 2, name: i === segs.length - 1 ? h1 : (s.charAt(0).toUpperCase() + s.slice(1)), item: org + acc + "/" }); });
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items };
}
function faqSchema(raw) {  // extrai pares **P: …?** / R: … (metodologia §12) → FAQPage citável
  const lines = raw.split("\n"); const out = []; let q = null;
  for (const ln of lines) {
    const t = ln.trim();
    const qm = t.match(/^\*\*P:\s*(.+?)\*\*$/) || t.match(/^\*\*Q:\s*(.+?)\*\*$/);
    if (qm) { q = qm[1]; continue; }
    const am = t.match(/^R:\s*(.+)/) || t.match(/^A:\s*(.+)/);
    if (am && q) { out.push({ q, a: am[1].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") }); q = null; }
  }
  return out.length ? { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": out.map((f) => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })) } : null;
}
// ★ 2026-06-29: FAQ dos conceitos como dado do gerador (source-safe) — emite FAQPage JSON-LD + Q&A VISÍVEL (Google exige conteúdo visível).
const CONCEPT_FAQ = {"regime-brasil": {"pt": [{"q": "O que é o Regime Brasil?", "a": "Uma síntese diária do ambiente brasileiro lida em quatro buckets categóricos (defensivo, neutro, pró-risco, pró-risco amplo), com escala auxiliar de 0 a 100 para distinguir intensidade. O Regime Brasil combina sinais quantitativos do intermercado brasileiro e calibrações qualitativas das cinco lentes regulatórias do Radar. O agregado nunca aparece sozinho — sempre com a decomposição do que está pesando dentro dele."}, {"q": "Por que existe o Regime Brasil?", "a": "Porque indicadores isolados se contradizem, mas o capital opera em ambiente integrado. O Regime Brasil é a resposta à primeira pergunta operacional que qualquer alocador faz pela manhã: em que terreno estou pisando hoje? Sem essa leitura, todo indicador subsequente perde âncora."}, {"q": "O que o Regime Brasil não significa?", "a": "Não significa recomendação. Regime defensivo não diz \"venda\"; regime pró-risco não diz \"compre\". O regime é o terreno; a decisão é do leitor, do alocador, do profissional habilitado. Não significa previsão. Regime descreve o que está acontecendo; previsão atribui certeza ao que ainda não aconteceu. São operações diferentes."}, {"q": "Quais são as limitações do Regime Brasil?", "a": "A janela estatística usada começa em 2000 — antes, a hiperinflação distorce. O regime é categórico por escolha de design: o Radar prefere admitir incerteza categorizada a fingir precisão pontual. Em períodos de baixa densidade ou alta volatilidade idiossincrática, o regime fica em calibração."}], "en": [{"q": "What is the Brazil Regime?", "a": "A daily synthesis of the Brazilian environment read into four categorical buckets (defensive, neutral, pro-risk, broad pro-risk), with an auxiliary 0–100 scale for intensity. The Brazil Regime combines quantitative signals from Brazilian intermarket and qualitative calibrations from the Radar's five regulatory lenses. The aggregate never appears alone — always with the breakdown of what is weighing inside it."}, {"q": "Why does the Brazil Regime exist?", "a": "Because isolated indicators contradict each other, but capital operates in an integrated environment. The Brazil Regime answers the first operational question any allocator asks each morning: what terrain am I standing on today? Without that reading, every subsequent indicator loses anchor."}, {"q": "What does the Brazil Regime not mean?", "a": "It does not mean a recommendation. A defensive regime does not say \"sell\"; a pro-risk regime does not say \"buy\". The regime is the terrain; the decision belongs to the reader, the allocator, the licensed professional. It does not mean a forecast. The regime describes what is happening; a forecast assigns certainty to what has not yet happened. They are different operations."}, {"q": "What are the Brazil Regime's limits?", "a": "The statistical window begins in 2000 — before that, hyperinflation distorts. The regime is categorical by design choice: the Radar prefers admitting categorized uncertainty over feigning point precision. In periods of low density or high idiosyncratic volatility, the regime is in calibration."}]}, "regime-global": {"pt": [{"q": "O que é o Regime Global?", "a": "Síntese diária do ambiente macro externo, lida na mesma escala categórica do Regime Brasil (defensivo, neutro, pró-risco) e em escala auxiliar 0–100. Combina sinais clássicos de risco global — volatilidade, força do dólar, juros longos americanos, ouro, pares de câmbio defensivos. É leitura de contexto externo , não de Brasil; só faz sentido cruzado com os outros eixos."}, {"q": "Por que existe o Regime Global?", "a": "Porque o capital que opera no Brasil é, na maior parte, sensível ao ambiente global. Um regime pró-risco global pode salvar o IBOV de um regime regulatório doméstico ruim — e um regime defensivo global pode derrubar IBOV mesmo com domestic em ordem. Ler só um lado é meia-leitura."}, {"q": "O que o Regime Global não significa?", "a": "Não é o S&P 500. Não é o ouro. Não é o dólar isolado. É uma síntese — e síntese não é cotação. Olhar só Regime Global e ignorar Regime Brasil é o oposto do que o Radar foi construído para fazer."}, {"q": "Quais são as limitações do Regime Global?", "a": "Os sinais externos são lidos em sua própria janela; transmissão para o Brasil tem defasagem variável (semanas a meses). O Radar identifica defasagens em janelas históricas semelhantes (ver Análogos Históricos), não cravando ponto."}], "en": [{"q": "What is the Global Regime?", "a": "A daily synthesis of the external macro environment, read on the same categorical scale as the Brazil Regime (defensive, neutral, pro-risk) and the same 0–100 auxiliary scale. It combines classical global-risk signals — volatility, dollar strength, US long rates, gold, defensive FX pairs. It is external context , not Brazil; it only makes sense crossed with the other axes."}, {"q": "Why does the Global Regime exist?", "a": "Because capital operating in Brazil is, mostly, sensitive to the global environment. A pro-risk global regime can rescue the IBOV from a bad domestic regulatory regime — and a defensive global regime can drag IBOV down even with domestic in order. Reading one side is half-reading."}, {"q": "What does the Global Regime not mean?", "a": "It is not the S&P 500. It is not gold. It is not the dollar in isolation. It is a synthesis — and a synthesis is not a quote. Watching only the Global Regime and ignoring the Brazil Regime is the opposite of what the Radar was built to do."}, {"q": "What are the Global Regime's limits?", "a": "External signals are read in their own window; transmission to Brazil has variable lag (weeks to months). The Radar identifies lags in historically similar windows (see Historical Analogs), never nailing a point."}]}, "intermercado-br": {"pt": [{"q": "O que é o Intermercado BR?", "a": "Conjunto de razões patrimoniais brasileiras, lidas como percentis históricos em escala normalizada: finanças ÷ IBOV, utilities ÷ IBOV, commodities ÷ IBOV, FIIs ÷ IBOV, cíclico ÷ defensivo, NTN-B longa ÷ curta (fuga para duração = aversão a risco) e a cesta proprietária de commodities em reais (reflação × câmbio — \"a nossa cara\"). Cada razão devolve um sinal direcional; a combinação gera o eixo Intermercado do Regime Brasil. (Razões cujo histórico no Brasil não se mostrou consistente — como café÷ouro e VALE÷ouro — ficam apenas informativas, sem peso: testamos com rigor e só mantemos com peso o que a série brasileira sustenta.)"}, {"q": "Por que existe o Intermercado BR?", "a": "Porque o capital se posiciona em rotação setorial antes de virar manchete. Quando finanças começam a ceder contra IBOV, ou quando utilities lideram, ou quando FIIs ultrapassam IBOV, há leitura ali — leitura que o Radar formaliza e quantifica antes de qualquer narrativa surgir. A frase-tese do produto vem desse fato: o capital tende a se posicionar antes da manchete."}, {"q": "O que o Intermercado BR não significa?", "a": "Não é stock picking. Razão subindo não diz \"compre\". Razão é leitura agregada de fluxo setorial, não recomendação operacional. Não é previsão. A razão lê o presente; o que se segue depende do ambiente global, do regulatório, do fluxo externo, do humor do mercado — variáveis que o Radar combina, mas não cravam ponto."}, {"q": "Quais são as limitações do Intermercado BR?", "a": "A composição interna de cada cesta é mantida ponderada por capitalização para evitar distorção por peso oficial trimestral. Survivor bias e look-ahead em cestas com constituintes históricos são declarados quando aplicável. Quando os componentes mudam materialmente, a calibração é refeita."}], "en": [{"q": "What is the Intermarket BR?", "a": "A set of Brazilian wealth-sector ratios read as historical percentiles on a normalized scale: finance ÷ IBOV, utilities ÷ IBOV, commodities ÷ IBOV, REITs ÷ IBOV, cyclical ÷ defensive, long ÷ short inflation-linked bonds (flight to duration = risk aversion), and the proprietary commodity basket in reais (reflation × FX). Each ratio returns a directional signal; the combination generates the Intermarket axis of the Brazil Regime. (Ratios whose Brazilian history did not prove consistent — such as coffee÷gold and VALE÷gold — stay informational only, with no weight: we test rigorously and keep weight only on what the Brazilian series supports.)"}, {"q": "Why does the Intermarket BR exist?", "a": "Because capital positions itself in sectoral rotation before turning into headline. When finance starts ceding against IBOV, or when utilities lead, or when REITs surpass IBOV, there is a reading there — a reading the Radar formalizes and quantifies before any narrative emerges. The product's thesis sentence comes from this fact: capital tends to position before the headline."}, {"q": "What does the Intermarket BR not mean?", "a": "It is not stock picking. A rising ratio does not say \"buy\". A ratio is the aggregate reading of sectoral flow, not an operational recommendation. It is not a forecast. The ratio reads the present; what follows depends on the global environment, the regulatory layer, foreign flow, market mood — variables the Radar combines but does not crystallize into points."}, {"q": "What are the Intermarket BR's limits?", "a": "The internal composition of each basket is market-cap weighted to avoid distortion from quarterly official weighting. Survivor bias and look-ahead in baskets with historical constituents are declared where applicable. When components materially change, calibration is redone."}]}, "erp-br": {"pt": [{"q": "O que é o ERP_BR?", "a": "Diferencial entre o earnings yield agregado do mercado acionário brasileiro e o juro real ex-ante doméstico, lido em percentil histórico dentro do regime monetário moderno. Expresso em pontos percentuais com referência da janela histórica usada."}, {"q": "Por que existe o ERP_BR?", "a": "Porque o Brasil tem juros estruturalmente altos — e isso muda a régua de valuation. O P/L sozinho mente; o earnings yield sozinho mente; o juro real sozinho mente. O ERP_BR junta os dois lados da decisão patrimonial e os contextualiza dentro do próprio histórico brasileiro, não contra um benchmark americano que opera em outro regime. Sem ERP_BR, a pergunta ações brasileiras estão caras ou baratas? é uma armadilha. Com ERP_BR, ela vira o prêmio atual está alto ou baixo em relação à sua própria distribuição histórica? — pergunta operacional e respondível."}, {"q": "O que o ERP_BR não significa?", "a": "Não significa recomendação de compra. Prêmio elevado pode permanecer elevado por meses ou anos sob deterioração estrutural — ver Argentina histórica como contra-exemplo extremo. Prêmio é leitura de assimetria, não de timing. Não significa que ações vão subir. Significa que o desconto está descontado mais do que historicamente costumou estar — informação relevante, não decisão pronta."}, {"q": "Quais são as limitações do ERP_BR?", "a": "O ERP_BR usa juro real ex-ante (Focus mediano de Selic e IPCA) — não é juro real de mercado, que difere em períodos de stress. O earnings yield é o agregado IBOV — não captura assimetrias entre setores. A janela histórica usada começa em 2000."}], "en": [{"q": "What is the ERP_BR?", "a": "The differential between the aggregate earnings yield of the Brazilian equity market and the domestic ex-ante real rate, read as a historical percentile within the modern monetary regime. Expressed in percentage points with the reference window declared."}, {"q": "Why does the ERP_BR exist?", "a": "Because Brazil has structurally high interest rates — and that changes the valuation ruler. P/E alone lies; earnings yield alone lies; real rate alone lies. ERP_BR joins both sides of the wealth decision and contextualizes them within Brazil's own history, not against a US benchmark that operates in a different regime. Without ERP_BR, the question are Brazilian stocks cheap or expensive? is a trap. With ERP_BR, it becomes is the current premium high or low relative to its own historical distribution? — an operational, answerable question."}, {"q": "What does the ERP_BR not mean?", "a": "It does not mean a buy recommendation. An elevated premium can stay elevated for months or years under structural deterioration — see historical Argentina as an extreme counter-example. Premium is a reading of asymmetry, not of timing. It does not mean stocks will rise. It means the discount is discounted more than it historically has been — relevant information, not a ready-made decision."}, {"q": "What are the ERP_BR's limits?", "a": "ERP_BR uses ex-ante real rates (Focus median for Selic and CPI) — it is not the market real rate, which differs in stress periods. The earnings yield is the IBOV aggregate — it does not capture asymmetries between sectors. The historical window starts in 2000."}]}, "cone-de-regressao-logaritmica": {"pt": [{"q": "O que é o Cone de Regressão Logarítmica?", "a": "Uma regressão logarítmica ajusta a tendência de longo prazo do preço (a \"linha central\") sobre uma janela histórica declarada; o cone é a faixa que mostra desvios típicos em torno dessa linha, expressos por bandas calibradas pelo desvio-padrão histórico do resíduo. Preço acima do topo do cone: ativo esticado em relação à própria trajetória de longo prazo. Preço dentro do cone: dentro da faixa típica. Preço abaixo do cone: ativo contraído."}, {"q": "Por que existe o Cone de Regressão Logarítmica?", "a": "Porque a pergunta o ativo está caro ou barato? é difícil quando o ativo viveu décadas de regimes diferentes. O Cone normaliza essa pergunta: está caro ou barato em relação à sua própria trajetória de longo prazo, descontada a tendência? A escala logarítmica importa porque retornos compõem multiplicativamente. Em linear, IBOV em 30 mil pontos parece \"longe\" de IBOV em 130 mil — em log, a distância percentual é a que conta."}, {"q": "O que o Cone de Regressão Logarítmica não significa?", "a": "Não significa que o preço vai retornar à média. Mercados podem permanecer em desvio por anos. O cone descreve assimetria atual; reversão à média é hipótese estatística que pode demorar ou nunca acontecer dentro do horizonte do leitor. Não significa previsão de preço. O cone é descritivo — aqui está onde o preço está em relação à sua história . O Radar nunca prevê o ponto de chegada."}, {"q": "Quais são as limitações do Cone de Regressão Logarítmica?", "a": "A janela histórica escolhida afeta a inclinação da regressão e a largura do cone. O Radar declara janela e parâmetros usados em cada gráfico. Ativos com mudança estrutural (split, mudança regulatória profunda, listagem recente) podem ter cone instável."}], "en": [{"q": "What is the Logarithmic Regression Cone?", "a": "A logarithmic regression fits the long-term price trend (the \"central line\") over a declared historical window; the cone is the band showing typical deviations around that line, expressed by bands calibrated by the historical standard deviation of the residual. Price above the upper band: asset stretched relative to its own long-term trajectory. Price inside the cone: within the typical band. Price below the cone: asset contracted."}, {"q": "Why does the Logarithmic Regression Cone exist?", "a": "Because the question is the asset expensive or cheap? is hard when the asset has lived through decades of different regimes. The Cone normalizes that question: is it expensive or cheap relative to its own long-term trajectory, with trend discounted? The logarithmic scale matters because returns compound multiplicatively. On a linear scale, IBOV at 30,000 looks \"far\" from IBOV at 130,000 — on log, percentage distance is what counts."}, {"q": "What does the Logarithmic Regression Cone not mean?", "a": "It does not mean price will revert to the mean. Markets can remain in deviation for years. The cone describes current asymmetry; mean reversion is a statistical hypothesis that may take long or never occur within the reader's horizon. It does not mean a price forecast. The cone is descriptive — here is where price is relative to its history . The Radar never forecasts the destination point."}, {"q": "What are the Logarithmic Regression Cone's limits?", "a": "The chosen historical window affects the slope of the regression and the width of the cone. The Radar declares window and parameters used in each chart. Assets with structural change (split, deep regulatory shift, recent listing) may have an unstable cone."}]}, "indice-anima": {"pt": [{"q": "O que é o Índice Ânima?", "a": "Uma leitura agregada do humor de um ativo ou índice — quão otimista ou pessimista o comportamento de preço, volume e participação está sugerindo, em relação à própria distribuição histórica do mesmo ativo. Expresso em escala 0–100 com faixas categóricas (pessimismo extremo, pessimismo, neutro, otimismo, otimismo extremo). O Ânima não copia indicador estrangeiro. Ele assume que o mercado brasileiro tem profundidade, liquidez e estrutura diferentes do mercado americano, e calibra-se contra a própria distribuição histórica brasileira."}, {"q": "Por que existe o Índice Ânima?", "a": "Porque sentimento é informação, mas raramente é informação direta. O preço diz onde estamos; o sentimento diz como o mercado se sente sobre estar ali. Quando os dois divergem — preço subindo com sentimento esticado, preço caindo com sentimento exausto — a leitura ganha valor. Existir um Índice Ânima é assumir que o leitor sofisticado se beneficia de saber se o humor do ativo está dentro da faixa normal ou em extremo histórico — sem precisar inferir isso de cinco indicadores separados."}, {"q": "O que o Índice Ânima não significa?", "a": "Não é sinal de compra ou venda. O Ânima diz que o humor do mercado está deixando de ser neutro — diz o estado, não a ação. Não é cópia do Fear & Greed americano. As variáveis e a calibração são proprietárias, ajustadas às particularidades do mercado brasileiro (menor profundidade, volume mais concentrado, sazonalidade diferente)."}, {"q": "Quais são as limitações do Índice Ânima?", "a": "Volume e profundidade no Brasil exigem cautela — ativos de baixa liquidez podem produzir leituras voláteis. O Ânima usa apenas ativos com profundidade suficiente para sustentar a leitura. Quando não há volume mínimo, o Ânima fica em calibração para o ativo."}], "en": [{"q": "What is the Ânima Index?", "a": "An aggregate reading of the mood of an asset or index — how optimistic or pessimistic the price, volume, and participation behavior is suggesting, relative to the asset's own historical distribution. Expressed on a 0–100 scale with categorical bands (extreme pessimism, pessimism, neutral, optimism, extreme optimism). Ânima does not copy any foreign indicator. It assumes the Brazilian market has different depth, liquidity, and structure from the US market, and calibrates against the Brazilian historical distribution itself."}, {"q": "Why does the Ânima Index exist?", "a": "Because sentiment is information, but rarely direct information. Price tells you where you are; sentiment tells you how the market feels about being there. When the two diverge — price rising with sentiment stretched, price falling with sentiment exhausted — the reading gains value. Having an Ânima Index is the assumption that the sophisticated reader benefits from knowing whether the asset's mood is within the normal band or at a historical extreme — without having to infer it from five separate indicators."}, {"q": "What does the Ânima Index not mean?", "a": "It is not a buy or sell signal. Ânima says market mood is ceasing to be neutral — it says state, not action. It is not a copy of the US Fear & Greed. The variables and calibration are proprietary, adjusted to the Brazilian market's particularities (lower depth, more concentrated volume, different seasonality)."}, {"q": "What are the Ânima Index's limits?", "a": "Volume and depth in Brazil demand caution — low-liquidity assets can produce volatile readings. Ânima uses only assets with sufficient depth to sustain the reading. Without minimum volume, Ânima stays in calibration for that asset."}]}, "risk-on-risk-off": {"pt": [{"q": "O que é o Índice de Risco Perene?", "a": "Um composto de amplitude de mercado (quantas ações brasileiras sustentam tendência) e apetite a risco cross-asset (small caps vs large caps, cíclicos vs defensivos), normalizado por range-rank de 84 dias — a posição do valor entre o mínimo e o máximo da janela recente, não um z-score. Acima de ~68 indica apetite a risco; abaixo de ~30, proteção. A construção é inspirada em leituras compostas de apetite a risco de mercado , adaptada ao Brasil (volume de negociação menor, câmbio volátil, inflação distinta) — sem copiar metodologia estrangeira. Acompanha qualquer ativo aberto, empilhado sob o preço junto ao Índice Ânima."}, {"q": "Por que existe o Índice de Risco Perene?", "a": "Porque o mesmo movimento de preço de um ativo tem leituras opostas dependendo do ambiente. Petrobras caindo com apetite a risco amplo é sinal idiossincrático (algo na empresa/setor/regulação); Petrobras caindo num risk-off forte é beta de mercado (todo mundo cai junto). Sem a inclinação de risco, o leitor confunde sinal idiossincrático com sistêmico."}, {"q": "O que o Índice de Risco Perene não significa?", "a": "Não significa que risk-on é bom e risk-off é ruim. Ambos são estados — leituras de ambiente; o que muda é a régua de assimetria. Não significa decisão, nem recomendação de compra ou venda: o \"sinal de virada\" é uma marcação descritiva de um padrão histórico, com o desfecho à mostra. A decisão continua humana."}, {"q": "Quais são as limitações do Índice de Risco Perene?", "a": "A leitura é diária e usa range-rank de 84 dias — transições podem levar dias a semanas para confirmar. A amplitude do mercado brasileiro é mais esparsa que a americana (o componente de breadth ganha robustez de 2009 em diante, quando as small caps passam a ter histórico). A medida é descritiva da distribuição histórica, nunca previsão."}], "en": [{"q": "What is the Perene Risk Index?", "a": "A composite of market breadth (how many Brazilian stocks sustain a trend) and cross-asset risk appetite (small caps vs large caps, cyclicals vs defensives), normalized by an 84-day range rank — the position of the value between the recent window's minimum and maximum, not a z-score. Above ~68 signals risk appetite; below ~30, protection. The construction is inspired by composite readings of market risk appetite , adapted to Brazil (lower trading volume, volatile FX, distinct inflation) — without copying any foreign methodology. It accompanies any open asset, stacked under price alongside the Ânima Index."}, {"q": "Why does the Perene Risk Index exist?", "a": "Because the same price move has opposite readings depending on the environment. Petrobras falling under broad risk appetite is an idiosyncratic signal (something in the company/sector/regulation); Petrobras falling in a strong risk-off is market beta (everyone falls together). Without the risk tilt, the reader confuses idiosyncratic with systemic."}, {"q": "What does the Perene Risk Index not mean?", "a": "It does not mean risk-on is good and risk-off is bad. Both are states; what changes is the asymmetry ruler. It is not a decision, nor a buy/sell recommendation: the \"turning-point signal\" is a descriptive mark of a historical pattern, with the outcome in plain sight. The decision remains human."}, {"q": "What are the Perene Risk Index's limits?", "a": "The reading is daily and uses an 84-day range rank — transitions may take days to weeks to confirm. Brazil's market breadth is sparser than the US's (the breadth component gains robustness from 2009 onward, when small caps have history). It is descriptive of the historical distribution, never a forecast."}]}, "analogos-historicos": {"pt": [{"q": "O que é o Análogos Históricos?", "a": "Para o estado atual do mercado, o motor busca em sua memória histórica as janelas que mais se parecem com a configuração de hoje (regime, intermercado, sentimento, contexto institucional) e mostra três coisas: quais foram essas janelas, o que se seguiu dentro de cada uma e qual a faixa de resultados observada na maioria dos casos. A pergunta operacional que isso responde é: quando vimos um perfil parecido com o de hoje, o que aconteceu nas semanas e meses seguintes?"}, {"q": "Por que existe o Análogos Históricos?", "a": "Porque a memória estatística calibra a interpretação. Sem análogos, todo regime parece único; com análogos, o presente entra em distribuição. Análogos transformam \"isto nunca aconteceu\" em \"isto se parece com X e Y; em janelas como X e Y, em N dos M casos, em K dias, o resultado foi Z\" ."}, {"q": "O que o Análogos Históricos não significa?", "a": "Não significa previsão. Análogo é distribuição; previsão é ponto. Análogos mostram o que tendeu a acontecer , não o que vai acontecer . A diferença é categórica. Não significa causalidade. Janelas históricas semelhantes não dizem que o que se seguiu naquelas janelas aconteceu por causa do regime — apenas que aconteceu em janelas com aquele perfil. A relação é temporal observada, nunca causal."}, {"q": "Quais são as limitações do Análogos Históricos?", "a": "A memória estatística começa em 2000. Análogos pré-2000 entram como referência qualitativa, não como ponto na distribuição. Janelas com baixa similaridade não são exibidas — o motor prefere admitir ausência de análogo a fabricar comparações fracas. Calibração em casos de regime sem precedente claro."}], "en": [{"q": "What is the Historical Analogs?", "a": "For the current state of the market, the engine searches its historical memory for windows that most resemble today's configuration (regime, intermarket, sentiment, institutional context) and shows three things: which windows those were, what followed within each, and the range of outcomes observed across most cases. The operational question this answers: when have we seen a profile similar to today's, what happened in the weeks and months that followed?"}, {"q": "Why does the Historical Analogs exist?", "a": "Because statistical memory calibrates interpretation. Without analogs, every regime feels unique; with analogs, the present enters a distribution. Analogs turn \"this has never happened\" into \"this resembles X and Y; in windows like X and Y, in N of M cases, over K days, the outcome was Z\" ."}, {"q": "What does the Historical Analogs not mean?", "a": "It does not mean a forecast. Analog is distribution; forecast is point. Analogs show what tended to happen , not what will happen . The difference is categorical. It does not mean causality. Historically similar windows do not say that what followed in those windows happened because of the regime — only that it happened in windows with that profile. The relation is observed temporal, never causal."}, {"q": "What are the Historical Analogs's limits?", "a": "Statistical memory begins in 2000. Pre-2000 analogs enter as qualitative reference, not as distribution points. Windows with low similarity are not displayed — the engine prefers admitting absence of analog over fabricating weak comparisons. Calibration in cases of regime without clear precedent."}]}, "vertice": {"pt": [{"q": "O que é o Vértice — o experimento metodológico?", "a": "Um sistema que formula hipóteses sobre relações entre domínios que normalmente não se conversam (por exemplo, liquidez global de cripto e o juro curto brasileiro; stress de crédito americano e risco-Brasil; fluxo VC tecnologia e small caps brasileiras). Cada hipótese é estruturada com evidências, contradições, o que a fortalece, o que a enfraquece, próximos sinais a observar e confiança contextual categórica. A Vértice opera em cadência mais rápida que as lentes principais (o engine quantitativo recalcula a cada quinze minutos), mas o disparo da geração de hipóteses é cirúrgico — apenas quando há mudança de regime, cruzamento relevante ou anomalia detectada."}, {"q": "Por que existe o Vértice — o experimento metodológico?", "a": "Porque há leituras patrimoniais relevantes que não cabem em macro tradicional. O capital brasileiro sofisticado opera em ambiente globalizado, com exposição a cripto, a fragilidade EM, a ciclos tech, a liquidez americana. Tratar essas dimensões como ruído é perder leitura; tratar como sinal exige metodologia diferente da do macro doméstico clássico. A Vértice é a tentativa de oferecer essa leitura sem trair os princípios do Radar — toda hipótese é estruturada, falsificável, com contradições listadas, e nenhuma hipótese vira recomendação."}, {"q": "O que o Vértice — o experimento metodológico não significa?", "a": "Não significa previsão. Hipótese é leitura atualizável; previsão é afirmação determinística. A Vértice nunca diz \"vai acontecer X\" — diz \"essa hipótese ganha força se A, B, C persistirem; perde força se D, E aparecerem\" . Não significa trade. Recalcular mais rápido (a cada quinze minutos) não vira chamada operacional. É leitura de regime mais fresca, não sinal de mercado."}, {"q": "Quais são as limitações do Vértice — o experimento metodológico?", "a": "A Vértice exige histórico acumulado para calibrar suas confianças categóricas — em ondas iniciais, muitas hipóteses ficam em calibração. O backtest formal das hipóteses é feito em t+10, t+20, t+60 e t+120 dias, e os labels de confiança são recalibrados conforme acerto histórico real. Análise cross-domínio com amostra curta é declarada como tal."}], "en": [{"q": "What is the Vértice — the methodological experiment?", "a": "A system that formulates hypotheses about relations between domains that normally do not converse (for example, global crypto liquidity and Brazil's short rates; US credit stress and Brazilian country risk; tech VC flow and Brazilian small caps). Each hypothesis is structured with evidence, contradictions, what strengthens it, what weakens it, next signals to watch, and categorical contextual confidence. Vértice runs at a faster cadence than the principal lenses (the quantitative engine recomputes every fifteen minutes), but the dispatch of hypothesis generation is surgical — only on regime change, relevant crossing, or detected anomaly."}, {"q": "Why does the Vértice — the methodological experiment exist?", "a": "Because there are relevant wealth-side readings that do not fit classical macro. Sophisticated Brazilian capital operates in a globalized environment, with exposure to crypto, EM fragility, tech cycles, US liquidity. Treating those dimensions as noise loses reading; treating them as signal requires a methodology different from classical domestic macro. Vértice is the attempt to offer that reading without betraying the Radar's principles — every hypothesis is structured, falsifiable, with contradictions listed, and no hypothesis becomes a recommendation."}, {"q": "What does the Vértice — the methodological experiment not mean?", "a": "It does not mean a forecast. A hypothesis is an updatable reading; a forecast is a deterministic statement. Vértice never says \"X will happen\" — it says \"this hypothesis gains strength if A, B, C persist; it loses strength if D, E appear\" . It does not mean a trade. Recomputing faster (every fifteen minutes) does not become an operational signal. It is a fresher regime reading, not a market signal."}, {"q": "What are the Vértice — the methodological experiment's limits?", "a": "Vértice requires accumulated history to calibrate its categorical confidences — in early waves, many hypotheses remain in calibration. Formal backtest of hypotheses is performed at t+10, t+20, t+60, and t+120 days, and confidence labels are recalibrated against real historical hit rates. Cross-domain analysis with a short sample is declared as such."}]}};
function buildSchemas(p, raw, block, lg, title, desc) {
  const en = lg === "en", org = en ? "https://radarperene.com" : ORG_BR, slug = en ? enSlug(p.slug) : p.slug;
  const url = org + "/" + slug + "/", inLang = en ? "en" : "pt-BR";
  const dts = { "@type": "DefinedTermSet", "name": en ? "The Radar Perene language" : "A linguagem do Radar Perene", "url": org + (en ? "/concepts/" : "/conceitos/") };
  const s = [{ "@context": "https://schema.org", "@type": "Organization", "@id": org + "/#org", "name": "Radar Perene", "url": org, "logo": org + "/og.png", "sameAs": ["https://radarperene.com", "https://radarperene.com.br"].filter((u) => u !== org), "founder": { "@id": "https://brazilcomplexity.com/about.html#person" }, "description": en ? "Brazilian regulatory intelligence read as data — regime, intermarket and context." : "Inteligência regulatória brasileira lida como dado — leitura de regime, intermercado e contexto." }];
  if (p.slug.includes("/")) s.push(breadcrumbSchema(slug, block.h1, org));
  const article = (t) => ({ "@context": "https://schema.org", "@type": t, "headline": title, "description": desc, "url": url, "inLanguage": inLang, "datePublished": "2026-06-04", "dateModified": SITE_LASTMOD, "author": { "@type": "Organization", "name": "Radar Perene" }, "publisher": { "@type": "Organization", "name": "Radar Perene", "url": org } });
  if (p.type === "metodo") { s.push(article("TechArticle")); const f = faqSchema(raw); if (f) s.push(f); s.push({ "@context": "https://schema.org", ...dts }); }
  else if (p.type === "conceito") { s.push({ "@context": "https://schema.org", "@type": "DefinedTerm", "name": block.h1, "description": desc, "inDefinedTermSet": dts, "url": url }); s.push(article("Article")); const _fl = (CONCEPT_FAQ[p.slug.split("/")[1]] || {})[en ? "en" : "pt"] || []; if (_fl.length) s.push({ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": _fl.map((x) => ({ "@type": "Question", "name": x.q, "acceptedAnswer": { "@type": "Answer", "text": x.a } })) }); }
  else if (p.type === "umbrella-conceitos") { s.push({ "@context": "https://schema.org", "@type": "CollectionPage", "name": block.h1, "description": desc, "url": url, "inLanguage": inLang }); s.push({ "@context": "https://schema.org", ...dts }); }
  else if (p.type === "lentes") s.push({ "@context": "https://schema.org", "@type": "CollectionPage", "name": block.h1, "description": desc, "url": url, "inLanguage": inLang });
  else if (p.type === "lente") s.push(article("Article"));
  else if (p.type === "guia") s.push({ "@context": "https://schema.org", "@type": "HowTo", "name": block.h1, "description": desc, "url": url, "inLanguage": inLang });
  else if (p.type === "free") s.push({ "@context": "https://schema.org", "@type": "WebAPI", "name": block.h1, "description": desc, "url": url, "documentation": org + (en ? "/api/docs/" : "/api/docs/"), "provider": { "@type": "Organization", "name": "Radar Perene" } });
  else if (p.type === "apidocs") s.push({ "@context": "https://schema.org", "@type": "WebAPI", "name": block.h1, "description": desc, "url": url, "documentation": url, "provider": { "@type": "Organization", "name": "Radar Perene" } });
  // ★ 2026-06-29: ramo "founder" REMOVIDO — /founder não é gerada nem é produto comprável (Offer 149 saía daqui).
  return s.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n");
}

// ─── RelatedConcepts (briefing §5.2) — grafo hub-spoke + link bidirecional p/ a metodologia ───
const CONCEPT_NAMES = {
  "regime-brasil": { pt: "Regime Brasil", en: "Brazil Regime" }, "regime-global": { pt: "Regime Global", en: "Global Regime" },
  "intermercado-br": { pt: "Intermercado BR", en: "Intermarket BR" }, "erp-br": { pt: "ERP_BR", en: "ERP_BR" },
  "cone-de-regressao-logaritmica": { pt: "Cone de Regressão Logarítmica", en: "Logarithmic Regression Cone" },
  "indice-anima": { pt: "Índice Ânima", en: "Ânima Index" }, "risk-on-risk-off": { pt: "Risk-on / Risk-off", en: "Risk-on / Risk-off" },
  "analogos-historicos": { pt: "Análogos Históricos", en: "Historical Analogs" }, "vertice": { pt: "Vértice", en: "Vértice" },
};
const CONCEPT_GRAPH = {
  "regime-brasil": ["intermercado-br", "erp-br", "analogos-historicos"], "regime-global": ["regime-brasil", "risk-on-risk-off"],
  "intermercado-br": ["regime-brasil", "risk-on-risk-off", "indice-anima"], "erp-br": ["cone-de-regressao-logaritmica", "regime-brasil"],
  "cone-de-regressao-logaritmica": ["erp-br", "analogos-historicos"], "indice-anima": ["risk-on-risk-off", "intermercado-br"],
  "risk-on-risk-off": ["indice-anima", "regime-global", "regime-brasil"], "analogos-historicos": ["regime-brasil", "vertice"],
  "vertice": ["analogos-historicos", "intermercado-br", "regime-global"],
};
function relatedHtml(bareSlug, L) {  // L=true → EN (slugs EN); false → PT
  const rel = (CONCEPT_GRAPH[bareSlug] || []).filter((r) => CONCEPT_NAMES[r]);
  const cu = (r) => L ? "/" + enSlug("conceitos/" + r) + "/" : "/conceitos/" + r + "/";
  const links = rel.map((r) => `<a href="${cu(r)}">${esc(CONCEPT_NAMES[r][L ? "en" : "pt"])}</a>`).join(" · ");
  const method = `<a href="${L ? "/methodology/" : "/metodologia/"}">${L ? "see the full method" : "ver no método completo"}</a>`;
  return `<p class="rel" style="margin-top:26px">${L ? "Related concepts" : "Conceitos relacionados"}: ${links} · ${method}</p>`;
}

const out = [];
// footers estáticos crawláveis por idioma (slugs PT no .com.br, EN no .com)
const FOOT_PT = '<a href="/metodologia/">Metodologia</a> · <a href="/como-ler-o-radar/">Como ler</a> · <a href="/conceitos/">Conceitos</a> · <a href="/lentes/">Lentes</a> · <a href="/diario">Diário</a> · <a href="/free/">Versão grátis</a> · <a href="/ativos">Ativos</a> · <a href="/founder/">Institucional</a> · <a href="/api/docs/">API</a> · <a href="/widgets/">Widgets</a> · <a href="/sobre">Sobre</a> · <a href="/termos/">Termos</a> · <a href="/privacidade/">Privacidade</a>';
const FOOT_EN = '<a href="/methodology/">Methodology</a> · <a href="/how-to-read-the-radar/">How to read</a> · <a href="/concepts/">Concepts</a> · <a href="/lenses/">Lenses</a> · <a href="/diario">Daily</a> · <a href="/free/">Free</a> · <a href="/ativos">Assets</a> · <a href="/founder/">Institutional</a> · <a href="/api/docs/">API</a> · <a href="/widgets/">Widgets</a> · <a href="/about">About</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a>';
const PG_CSS = '<style>.pg{max-width:760px;margin:0 auto;padding:8px 0 20px}.pg h1{font-family:var(--serif);font-weight:500;font-size:clamp(28px,4.4vw,42px);line-height:1.14;margin:18px 0 22px;letter-spacing:-.01em}.pg h2.sec{margin-top:30px;font-size:clamp(19px,2.6vw,24px)}.pg h3.sub{margin-top:22px;font-size:16.5px;color:var(--txt)}.pg p{font-size:15.5px;color:var(--txt2);margin:0 0 15px}.pg .rel{font-size:13px;color:var(--dim)}.pg .rel a:not(.btn),.pg p a:not(.btn){color:var(--gold-ink)}.pg .livestate{font-family:var(--mono);font-size:12px;color:var(--dim);background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:10px 13px}.pg .ctarow{margin:22px 0 6px}.pg ol,.pg ul{color:var(--txt2);font-size:15px;padding-left:22px;margin:0 0 15px}.pg ol li,.pg ul li{margin:5px 0}.pg blockquote.ex{margin:6px 0 16px;padding:12px 15px;border-left:2px solid var(--gold);background:var(--surface2);border-radius:0 9px 9px 0;font-size:14px;color:var(--txt2);font-style:italic}.pg table.tb{width:100%;border-collapse:collapse;margin:6px 0 18px;font-size:13.5px}.pg table.tb th,.pg table.tb td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);color:var(--txt2);vertical-align:top}.pg table.tb th{color:var(--txt);font-weight:600;border-bottom:1.5px solid var(--line)}.pg .closing{font-family:var(--serif);font-size:17px;color:var(--txt);margin-top:24px;font-style:italic}.pg pre.api{background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:11px 13px;overflow:auto;font-size:12px}.crumb{font-size:12px;color:var(--dim);margin:6px 0 0}.crumb a{color:var(--gold-ink)}footer .ftnav{font-size:12.5px;line-height:2;color:var(--dim);margin:0 0 12px}footer .ftnav a{color:var(--dim);text-decoration:none}footer .ftnav a:hover{color:var(--gold-ink)}.brand .logo-w{display:block;height:35px;width:auto}:root[data-theme="dark"] .logo-w-light{display:none}:root:not([data-theme="dark"]) .logo-w-dark{display:none}</style>';
// site-kit (favicons/ícones/manifest) + logo real (wordmark light/dark, LOGO_IMG) — paridade total com a home.
// (logo-bússola antiga BRAND_SVG removida 2026-06-19: a marca usa LOGO_IMG)
const SITE_KIT = '<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n<link rel="icon" type="image/svg+xml" href="/icon-light.svg" media="(prefers-color-scheme: light)">\n<link rel="icon" type="image/svg+xml" href="/icon-dark.svg" media="(prefers-color-scheme: dark)">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#131521">\n<link rel="manifest" href="/site.webmanifest">';
const LOGO_IMG = '<img class="logo-w logo-w-light" src="/logo-light.svg" alt="Radar Perene" width="139" height="35"><img class="logo-w logo-w-dark" src="/logo-dark.svg" alt="Radar Perene" width="139" height="35">';
const THEME_JS = '<script>(function(){try{var t=localStorage.getItem("rp-theme");if(t!=="light"&&t!=="dark")t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}var tg=document.getElementById("theme-tg");if(tg)tg.onclick=function(){var c=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",c);try{localStorage.setItem("rp-theme",c);}catch(e){}};})();</script>';

// renderFile: gera UM arquivo mono-língua (PT→/{slug}/ em .com.br · EN→/{enSlug}/ em .com), canonical próprio + hreflang cruzado
function renderFile(p, lg, block, raw, title, desc) {
  const en = lg === "en";
  const ptPath = "/" + p.slug + "/", enPath = "/" + enSlug(p.slug) + "/";
  const slug = en ? enSlug(p.slug) : p.slug, path = en ? enPath : ptPath;
  const origin = en ? "https://radarperene.com" : "https://radarperene.com.br", canon = origin + path;
  const ld = buildSchemas(p, raw, block, lg, title, desc);
  const disc = block.disclaimer || (en ? "Radar Perene provides contextual regulatory intelligence. Nothing here constitutes legal, accounting, economic, or investment advice." : "O Radar Perene fornece inteligência regulatória contextualizada. Não constitui parecer jurídico, contábil, econômico ou de investimento.");
  // Anúncios SÓ em conceitos e metodologia (plano do dono); guia/lentes/free/legal/founder/api ficam limpos.
  // 1 In-article após a introdução + 1 Multiplex no fim. Gateados pelo /ads.js (Founder não vê).
  const adOn = (p.type === "conceito" || p.type === "metodo");   // conteúdo: in-article + multiplex
  const hubAd = (p.type === "umbrella-conceitos");                // hub de descoberta: só multiplex (igual ao hub /artigos)
  let bodyOut = block.bodyHtml;
  if (adOn) {
    const inArt = '<div class="ad-slot" data-ad-type="in-article" style="min-height:90px;margin:18px 0"></div>';
    const k = bodyOut.indexOf("</p>");   // logo após o 1º parágrafo (introdução)
    bodyOut = k >= 0 ? bodyOut.slice(0, k + 4) + "\n" + inArt + "\n" + bodyOut.slice(k + 4) : inArt + "\n" + bodyOut;
  }
  // 2026-06-29: FAQ visível (casa o FAQPage JSON-LD) p/ conceitos
  if (p.type === "conceito") {
    const _fl = (CONCEPT_FAQ[p.slug.split("/")[1]] || {})[en ? "en" : "pt"] || [];
    if (_fl.length) bodyOut += `\n<h2 class="sec">${en ? "Frequently asked questions" : "Perguntas frequentes"}</h2>\n` + _fl.map((x) => `<p><strong>${esc(x.q)}</strong> ${esc(x.a)}</p>`).join("\n");
  }
  // 2026-06-29: CTA R$29 source-safe p/ conteúdo editorial (conceito/guia/metodo) — sem isto o regen apaga o caminho de conversão
  if ((p.type === "conceito" || p.type === "guia" || p.type === "metodo") && !/class="ctarow/.test(bodyOut)) {
    bodyOut += en ? '\n<p class="ctarow rel"><a href="/subscribe">Follow the regime every day — Perene Semanal · US$ 29/mo →</a></p>'
                  : '\n<p class="ctarow rel"><a href="/assine">Acompanhe o regime todo dia — Perene Semanal · R$ 29/mês →</a></p>';
  }
  const multiplexSlot = (adOn || hubAd) ? '\n    <div class="ad-slot" data-ad-type="multiplex" style="min-height:90px;margin:26px 0 0"></div>' : "";
  const adsScript = (adOn || hubAd) ? '\n<script src="/ads.js" defer></script>' : "";
  const html = `<!doctype html>
<html lang="${en ? "en" : "pt-BR"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${p.noindex ? "noindex,follow" : "index,follow,max-image-preview:large"}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Radar Perene">
<meta property="og:locale" content="${en ? "en_US" : "pt_BR"}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="https://radarperene.com.br/og-image-1200x630.png">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://radarperene.com.br/og-image-1200x630.png">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
${SITE_KIT}
<link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br${ptPath}">
<link rel="alternate" hreflang="en" href="https://radarperene.com${enPath}">
<link rel="alternate" hreflang="x-default" href="https://radarperene.com.br${ptPath}">
${ld}
${headStyle}
${PG_CSS}
</head>
<body>
<a class="skip" href="#main">${en ? "Skip to content" : "Pular para o conteúdo"}</a>
<header class="top">
  <a class="brand" href="/" style="text-decoration:none" aria-label="Radar Perene">${LOGO_IMG}</a>
  <div class="lang"><a href="/">← ${en ? "home" : "início"}</a> <button id="theme-tg" class="tg" type="button" aria-label="theme">☾</button></div>
</header>
<main id="main">
<div class="wrap">
  <article class="pg">
    <p class="crumb"><a href="/">Radar Perene</a> / ${esc(crumbLabel(p.slug, en))}</p>
    <h1>${esc(block.h1)}</h1>
    ${bodyOut}${multiplexSlot}
  </article>
</div>
</main>
<footer>
  <nav class="ftnav">${en ? FOOT_EN : FOOT_PT}</nav>
  <p class="disc">${esc(disc)}</p>
  <p>© Radar Perene · <a href="/" style="color:var(--gold-ink)">${en ? "radarperene.com" : "radarperene.com.br"}</a></p>
</footer>
${THEME_JS}${adsScript}
</body>
</html>`;
  const dir = join(ROOT, slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // slug COMPARTILHADO (enSlug == ptSlug, ex.: api/docs, founder): o EN não pode sobrescrever o PT → vai p/ index.en.html
  // (o worker serve a versão EN no .com; o .com.br serve o index.html em PT por padrão). Evita a página sair só em inglês.
  const collisionEN = en && enSlug(p.slug) === p.slug;
  writeFileSync(join(dir, collisionEN ? "index.en.html" : "index.html"), html);
}

function page(p) {
  const B = BLOCKS[p.src] || {};
  CUR_LANG = "pt"; const pt = renderBlock(B[p.sec[0]] || "");
  CUR_LANG = "en"; const en = renderBlock(B[p.sec[1]] || "");
  CUR_LANG = "pt";
  if (!pt.h1 && !pt.title) {  // fonte ausente (Burst removido) → NÃO regenera; preserva o HTML no disco
    console.log(`  ⤼ /${p.slug.padEnd(40)} PULADO (fonte ${p.src}:${p.sec[0]} ausente — HTML existente preservado)`);
    return;
  }
  if (p.type === "conceito") {  // RelatedConcepts no rodapé (hub-spoke + ponte p/ metodologia) — slugs por idioma
    const bare = p.slug.split("/")[1];
    pt.bodyHtml += relatedHtml(bare, false); en.bodyHtml += relatedHtml(bare, true);
  }
  const sov = SEO_OVERRIDE[p.slug] || {};
  const clampD = (s, n) => { s = String(s || ""); return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "").replace(/[\s,.;:—–-]+$/, ""); };
  const tPt = sov.tPt || pt.title, tEn = sov.tEn || en.title, dPt = clampD(sov.dPt || pt.desc, 150), dEn = clampD(sov.dEn || en.desc, 150);
  renderFile(p, "pt", pt, B[p.sec[0]] || "", tPt, dPt);   // PT em /{slug}/ (.com.br)
  renderFile(p, "en", en, B[p.sec[1]] || "", tEn, dEn);   // EN em /{enSlug}/ (.com)
  out.push({ slug: p.slug, enSlug: enSlug(p.slug), title: tPt, enTitle: tEn, h1: pt.h1, desc: dPt, descEn: dEn, paras: (pt.bodyHtml.match(/<p>/g) || []).length, tables: (pt.bodyHtml.match(/<table/g) || []).length });
}

for (const p of PAGES) page(p);

// ─── sitemap.xml: home + /sobre + /about + todas as PAGES, em AMBOS domínios, com hreflang. TUDO com trailing slash p/ diretórios. ───
const LASTMOD = "2026-06-04";
const su = (loc, alt, freq, pri) => `<url><loc>${loc}</loc>${alt}<lastmod>${LASTMOD}</lastmod><changefreq>${freq}</changefreq><priority>${pri}</priority></url>`;
const aboutAlt = `<xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br/sobre"/><xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com/about"/><xhtml:link rel="alternate" hreflang="x-default" href="https://radarperene.com/about"/>`;
const rows = [
  su("https://radarperene.com/", `<xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com/"/><xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br/"/><xhtml:link rel="alternate" hreflang="x-default" href="https://radarperene.com/"/>`, "daily", "1.0"),
  su("https://radarperene.com.br/", `<xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br/"/><xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com/"/><xhtml:link rel="alternate" hreflang="x-default" href="https://radarperene.com/"/>`, "daily", "1.0"),
  su("https://radarperene.com.br/sobre", aboutAlt, "monthly", "0.8"),
  su("https://radarperene.com/about", aboutAlt, "monthly", "0.8"),
];
// /ativos — hub de ativos (worker-served, 1 rota/2 domínios). De-orfaniza as /ativo; em sitemap separado p/ as folhas (/sitemap-ativos.xml).
const ativosAlt = `<xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br/ativos"/><xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com/ativos"/><xhtml:link rel="alternate" hreflang="x-default" href="https://radarperene.com/ativos"/>`;
rows.push(su("https://radarperene.com/ativos", ativosAlt, "daily", "0.6"));
rows.push(su("https://radarperene.com.br/ativos", ativosAlt, "daily", "0.6"));
for (const p of PAGES) {
  if (p.noindex) continue;   // 2026-06-29: noindex,follow não vai ao sitemap
  const ptPath = "/" + p.slug + "/", enPath = "/" + enSlug(p.slug) + "/";
  const pri = p.type === "metodo" || p.type === "lentes" || p.type === "guia" ? "0.8" : (p.type === "conceito" ? "0.7" : "0.7");
  // PT canônico em .com.br/{ptSlug}, EN em .com/{enSlug}; hreflang cruzado, x-default = PT (mercado primário)
  const alt = `<xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br${ptPath}"/><xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com${enPath}"/><xhtml:link rel="alternate" hreflang="x-default" href="https://radarperene.com.br${ptPath}"/>`;
  rows.push(su(`https://radarperene.com.br${ptPath}`, alt, "monthly", pri));
  rows.push(su(`https://radarperene.com${enPath}`, alt, "monthly", pri));
}
// ★ 2026-06-29: páginas hand-written (fora do PAGES) que DEVEM estar no sitemap — senão um regen as apaga do índice.
const HANDWRITTEN_SITEMAP = [
  { pt: "/termos/", en: "/terms/", pri: "0.5" },
  { pt: "/conceitos/indice-de-liquidez-imobiliaria/", en: "/concepts/real-estate-liquidity-index/", pri: "0.7" },
];
for (const h of HANDWRITTEN_SITEMAP) {
  const alt = `<xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br${h.pt}"/><xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com${h.en}"/><xhtml:link rel="alternate" hreflang="x-default" href="https://radarperene.com.br${h.pt}"/>`;
  rows.push(su(`https://radarperene.com.br${h.pt}`, alt, "monthly", h.pri));
  rows.push(su(`https://radarperene.com${h.en}`, alt, "monthly", h.pri));
}
const _pagesXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join("\n")}\n</urlset>\n`;
// sitemap-pages.xml = filho do ÍNDICE /sitemap.xml (servido pelo worker, origin-aware, junto de ativos/indicadores/snapshots).
// sitemap.xml estático = fallback (o worker o sobrepõe via run_worker_first). Mantém os 2 em sync.
writeFileSync(join(ROOT, "sitemap-pages.xml"), _pagesXml);
writeFileSync(join(ROOT, "sitemap.xml"), _pagesXml);

// ─── relatório + validação de limites SEO (title ≤ 60 ideal/≤65 ok · description ≤ 160) ───
console.log("✓ sitemap-pages.xml + sitemap.xml:", rows.length, "URLs (páginas); índice /sitemap.xml soma ativos+indicadores+snapshots no worker)");
console.log("✓ blocos: Burst1", Object.keys(BLOCKS[1]).length, "· Burst2", Object.keys(BLOCKS[2]).length);
let warn = 0;
for (const r of out) {
  const tl = r.title.length, dl = r.desc.length, el = r.enTitle.length, edl = r.descEn.length;
  const w = [];
  if (!r.title) w.push("SEM TITLE pt"); if (!r.enTitle) w.push("SEM TITLE en");
  if (tl > 65) w.push(`title pt ${tl}c`); if (el > 65) w.push(`title en ${el}c`);
  if (dl > 160) w.push(`desc pt ${dl}c`); if (edl > 160) w.push(`desc en ${edl}c`);
  if (w.length) warn++;
  console.log(`  ${w.length ? "⚠" : "✓"} /${r.slug.padEnd(40)} ${r.paras}p ${r.tables}tb · t${tl}/${el} d${dl}/${edl}${w.length ? "  ← " + w.join(", ") : ""}`);
}
console.log(warn ? `\n⚠ ${warn} página(s) acima dos limites — revisar` : "\n✓ todos os títulos/descrições dentro dos limites");
