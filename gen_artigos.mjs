#!/usr/bin/env node
// Gerador da camada editorial /artigos — parseia o corpus de RADAR-REGULATORIO/biblioteca/artigos/{marquee,derivados,
// conceitos,comparativos}/*.md (frontmatter YAML + corpo markdown) e emite páginas estáticas PT reusando o MESMO chrome
// do index.html e os MESMOS estilos .pg da metodologia (espelha gen_pages.mjs).
// Doutrina: 1 página por episódio/conceito/comparativo em /artigos/{slug}/ (achatado, sem subpasta por tipo na URL),
// + hub /artigos/ + hubs de personagem /artigos/personagem/{p}/. PT-only por enquanto (servido nos 2 domínios).
// SEO: páginas-diretório servidas COM trailing slash (a forma sem barra 307→308) → canonical/hreflang/links internos
//      TODOS com barra final. AD_SLOTs vazios, altura reservada (CLS-safe), NENHUM script de anúncio (RP_ADS_ENABLED off).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = dirname(new URL(import.meta.url).pathname);
const RR = join(ROOT, "..", "RADAR-REGULATORIO");
const CORPUS = join(RR, "biblioteca", "artigos");
const SUBDIRS = ["marquee", "derivados", "conceitos", "comparativos"];
const INDEX = readFileSync(join(ROOT, "index.html"), "utf8");

// chrome compartilhado: o <link rel=preconnect…> até </head> do index, p/ casar fontes/tema/estilo 100% (igual gen_pages)
const headStyle = INDEX.slice(INDEX.indexOf("<link rel=\"preconnect\""), INDEX.indexOf("</head>"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ─── frontmatter YAML mínimo (só o que o corpus usa: escalares "a:b", listas inline ["x","y"], strings com aspas) ───
function parseFrontmatter(md) {
  if (!md.startsWith("---")) return { meta: {}, body: md };
  const end = md.indexOf("\n---", 3);
  const fmRaw = md.slice(3, end).trim();
  const body = md.slice(end + 4).replace(/^\s*\n/, "");
  const meta = {};
  for (const ln of fmRaw.split("\n")) {
    const m = ln.match(/^([a-z_]+):\s*(.*)$/i);
    if (!m) continue;
    const key = m[1]; let val = m[2].trim();
    if (val === "" ) { meta[key] = ""; continue; }
    if (val === "null") { meta[key] = null; continue; }
    if (val.startsWith("[")) {  // lista inline ["a","b"] ou []
      const inner = val.slice(1, val.lastIndexOf("]")).trim();
      meta[key] = inner ? inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")) : [];
      continue;
    }
    meta[key] = val.replace(/^["']|["']$/g, "");
  }
  return { meta, body };
}

// ─── carrega o corpus inteiro (PT = arquivos .md que NÃO são .en.md; EN = irmãos {slug}.en.md) ───
const ARTS = [];                 // só PT (a fonte da verdade da estrutura/hubs)
const EN_BY_SLUG = {};           // slug-PT → artigo EN (quando existe o espelho .en.md)
for (const sub of SUBDIRS) {
  const dir = join(CORPUS, sub);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".md") && !x.startsWith("_"))) {
    const { meta, body } = parseFrontmatter(readFileSync(join(dir, f), "utf8"));
    if (f.endsWith(".en.md") || meta.lang === "en") {        // espelho EN → indexa por slug-PT
      const ptSlug = meta.slug || f.replace(/\.en\.md$/, "");
      EN_BY_SLUG[ptSlug] = { slug: ptSlug, slugEn: meta.slug_en || ptSlug, sub, meta, body };
      continue;
    }
    const slug = meta.slug || f.replace(/\.md$/, "");
    ARTS.push({ slug, sub, meta, body });
  }
}
const SLUGS = new Set(ARTS.map((a) => a.slug));
const BY_SLUG = Object.fromEntries(ARTS.map((a) => [a.slug, a]));
// mapa slug-PT → slug-EN (só para os que têm espelho); EN_SLUGS = conjunto de slugs EN válidos p/ validar links internos EN
const EN_SLUG = Object.fromEntries(Object.values(EN_BY_SLUG).map((e) => [e.slug, e.slugEn]));
const EN_SLUGS = new Set(Object.values(EN_BY_SLUG).map((e) => e.slugEn));
const hasEn = (ptSlug) => !!EN_BY_SLUG[ptSlug];

// ─── personagens: o campo `personagens` mistura aliases curtos (humor/fluxo/estrutura/dolar/juros/anomalia) e slugs de
//     conceito (indice-anima/intermercado/…). Normalizamos para UMA chave canônica de personagem, derivada do campo
//     `personagem` de cada conceito (que é a fonte da verdade do mapeamento personagem↔verbete). §9.4 do canônico. ───
const PERSONAGEM_DE_CONCEITO = {};   // slug-conceito → personagem canônico (ex.: indice-anima → humor)
const CONCEITO_DE_PERSONAGEM = {};   // personagem canônico → slug-conceito (verbete)
for (const a of ARTS) {
  if (a.meta.tipo === "conceito" && a.meta.personagem) {
    PERSONAGEM_DE_CONCEITO[a.slug] = a.meta.personagem;
    CONCEITO_DE_PERSONAGEM[a.meta.personagem] = a.slug;
  }
}
// nomes de exibição dos personagens
const PERSONAGEM_NOME = {
  humor: "Humor", fluxo: "Fluxo (apetite por risco)", estrutura: "Estrutura (intermercado)",
  dolar: "Dólar", juros: "Juros (Selic)", anomalia: "Anomalia estatística",
  "ciclicos-defensivos": "Cíclicos × defensivos", commodities: "Commodities",
};
// EN: chave-de-rota de personagem (humor→mood, …) + nome de exibição EN (espelha o mapeamento do brief §2)
const PERSONAGEM_SLUG_EN = {
  humor: "mood", fluxo: "flow", estrutura: "structure", dolar: "dollar", juros: "rates",
  anomalia: "anomaly", "ciclicos-defensivos": "cyclicals-defensives", commodities: "commodities",
};
const PERSONAGEM_NOME_EN = {
  humor: "Mood", fluxo: "Flow (risk appetite)", estrutura: "Structure (intermarket)",
  dolar: "Dollar", juros: "Rates (Selic)", anomalia: "Statistical anomaly",
  "ciclicos-defensivos": "Cyclicals × defensives", commodities: "Commodities",
};
// ── parágrafo-abertura de ESTUDO no topo do hub de personagem (transforma índice → página-estudo) ──
const ESTUDO_INTRO = {
  commodities: {
    pt: `No Brasil, a commodity raramente é só commodity — é o câmbio disfarçado. Este é o estudo de quando a matéria-prima liderou o mercado, e de quantas vezes a força que parecia apetite por crescimento era, no fundo, um real fraco repreçando exportadoras. Os episódios abaixo rastreiam a razão Commodities(R$)/IBOV nos seus extremos: o reinado, o fim do reinado, e cada colheita que a moeda — não o mundo — decidiu.`,
    en: `In Brazil, a commodity is rarely just a commodity — it is the exchange rate in disguise. This is the study of when raw materials led the market, and how often the strength that looked like growth appetite was, underneath, a weak real repricing exporters. The episodes below trace the Commodities(BRL)/IBOV ratio at its extremes: the reign, the end of the reign, and every harvest decided by the currency, not the world.`,
  },
  "ciclicos-defensivos": {
    pt: `Toda bolsa tem dois cômodos: o que respira com a economia — os cíclicos — e o que paga aluguel indiferente a ela — os defensivos (utilities, tijolo, concessão). O dinheiro mora num ou no outro conforme o medo. Este é o estudo dessa mudança de endereço ao longo de quinze anos: quando o capital lotou o abrigo, quando voltou ao ciclo, e o que a rotação anunciou — e o que não.`,
    en: `Every market has two rooms: the one that breathes with the economy — the cyclicals — and the one that pays rent regardless of it — the defensives (utilities, real estate, concessions). Money lives in one or the other depending on fear. This is the study of that change of address across fifteen years: when capital filled the shelter, when it returned to the cycle, and what the rotation announced — and what it did not.`,
  },
  anomalia: {
    pt: `Uma anomalia estatística é um movimento tão fora do comum que deixa de ser ruído e passa a ser sinal de regime — três, quatro desvios da própria história. Não diz para onde o mercado vai; diz que o presente saiu do território comum. Este é o estudo dos extremos do arquivo: o apetite a 100 e a 0, o dólar em desvio raro, os quatro sigmas que mudaram — ou não — o que veio depois.`,
    en: `A statistical anomaly is a move so far out of the ordinary that it stops being noise and becomes a regime signal — three, four deviations from its own history. It does not say where the market is going; it says the present has left common territory. This is the study of the archive's extremes: appetite at 100 and at 0, the dollar in rare deviation, the four sigmas that changed — or did not — what came next.`,
  },
  juros: {
    pt: `O preço do dinheiro é o pano de fundo de tudo — e, em alguns meses, vira o protagonista. Este é o estudo da Selic como força de regime: o primeiro corte que rechama o risco, o aperto que encarece o medo, o juro real que paga para esperar, o piso e o teto. Quando o juro lidera, ele reorganiza a casa inteira.`,
    en: `The price of money is the backdrop to everything — and, in some months, it takes the lead. This is the study of the Selic as a regime force: the first cut that calls risk back, the tightening that makes fear expensive, the real rate that pays to wait, the floor and the ceiling. When rates lead, they rearrange the whole house.`,
  },
  humor: {
    pt: `O humor é o mais humano dos termômetros — e o mais traiçoeiro. O Índice Ânima mede o ânimo do mercado brasileiro de 0 a 100: o otimismo que aplaude antes da confirmação, o pessimismo que grita no fundo. Este é o estudo do humor nos seus extremos: quando liderou e acertou, quando disparou sozinho e capitulou, e quantas vezes o que as pessoas sentiam contradizia o que o dinheiro fazia.`,
    en: `Mood is the most human of thermometers — and the most treacherous. The Ânima Index measures the Brazilian market's spirit from 0 to 100: the optimism that applauds before confirmation, the pessimism that screams at the bottom. This is the study of mood at its extremes: when it led and was right, when it spiked alone and capitulated, and how often what people felt contradicted what the money did.`,
  },
  fluxo: {
    pt: `O apetite por risco é o pulso do mercado — quando o dinheiro avança e quando recolhe as fichas. O Índice de Risco Perene o mede de 0 (aversão plena) a 100 (euforia). Este é o estudo das pontas dessa escala: o apetite que cravou o teto às vésperas de uma queda, o que tocou o piso e marcou o começo — não o fim — de um processo, e o que cada extremo ensinou sobre o tempo entre o sinal e o desfecho.`,
    en: `Risk appetite is the market's pulse — when money advances and when it pulls its chips. The Perene Risk Index measures it from 0 (full aversion) to 100 (euphoria). This is the study of that scale's edges: the appetite that hit the ceiling on the eve of a fall, the one that touched the floor and marked the beginning — not the end — of a process, and what each extreme taught about the time between signal and outcome.`,
  },
  estrutura: {
    pt: `Sob o humor e o apetite há uma camada mais lenta e mais honesta: a estrutura de intermercado — as razões entre setores que revelam para onde o capital realmente vai, independentemente do que o mercado diz sentir. Este é o estudo dessa arquitetura: quando a estrutura travou enquanto o humor disparava, quando liderou a virada antes de todos, e por que o esqueleto costuma acertar o regime mesmo quando erra o tempo.`,
    en: `Beneath mood and appetite lies a slower, more honest layer: the intermarket structure — the ratios between sectors that reveal where capital actually goes, regardless of what the market says it feels. This is the study of that architecture: when structure stalled while mood surged, when it led the turn before anyone, and why the skeleton tends to get the regime right even when it gets the timing wrong.`,
  },
  dolar: {
    pt: `No Brasil, o dólar não é só preço — é regime. Quando o câmbio se desloca em anomalia, ele repreça a bolsa inteira, disfarça a força das commodities e dita o humor do crédito. Este é o estudo do dólar como eixo: as anomalias estatísticas da série (a R$ 4,88, a R$ 6,09), o câmbio que comandou a colheita, e as vezes em que a moeda — não a economia — escreveu o mês.`,
    en: `In Brazil, the dollar is not just a price — it is a regime. When the exchange rate moves in anomaly, it reprices the whole market, disguises the strength of commodities, and dictates the mood of credit. This is the study of the dollar as an axis: the archive's statistical anomalies (at R$ 4.88, at R$ 6.09), the currency that commanded the harvest, and the times when money — not the economy — wrote the month.`,
  },
};
// normaliza um token do campo personagens → chave canônica
function canonPersonagem(tok) {
  if (PERSONAGEM_NOME[tok]) return tok;                       // já é canônico
  if (PERSONAGEM_DE_CONCEITO[tok]) return PERSONAGEM_DE_CONCEITO[tok]; // é slug de conceito → seu personagem
  return tok;                                                 // fallback: usa como veio
}
const personagensDe = (a) => [...new Set((a.meta.personagens || (a.meta.personagem ? [a.meta.personagem] : [])).map(canonPersonagem))];

// índice personagem → artigos
const POR_PERSONAGEM = {};
for (const a of ARTS) for (const p of personagensDe(a)) (POR_PERSONAGEM[p] ||= []).push(a);

// ─── markdown inline: [txt](url), **bold**, *itálico*. Links internos validados por idioma. ───
//     CUR_LANG="pt" → /artigos/{slug}/ (valida contra SLUGS); "en" → /articles/{slugEn}/ (valida contra EN_SLUGS).
//     No corpo EN, [..](slug) pode trazer um slug-EN direto (preferido) OU um slug-PT que tenha espelho (mapeado).
let CUR_LANG = "pt";
function mdInline(s) {
  const en = CUR_LANG === "en";
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => {
      let u = url.trim();
      if (!en) {
        if (SLUGS.has(u)) u = "/artigos/" + u + "/";                  // [..](slug) → /artigos/slug/
        else if (u.startsWith("/") && !u.endsWith("/") && !u.includes("#") && !/\.[a-z0-9]+$/i.test(u)) u += "/";
        const ok = u.startsWith("/artigos/") ? SLUGS.has(u.slice(9).replace(/\/$/, "")) || u === "/artigos/" : true;
        return ok ? `<a href="${u}">${txt}</a>` : txt;
      }
      // EN
      if (EN_SLUGS.has(u)) u = "/articles/" + u + "/";                // já é slug-EN
      else if (EN_SLUG[u]) u = "/articles/" + EN_SLUG[u] + "/";       // é slug-PT com espelho → mapeia p/ EN
      else if (SLUGS.has(u)) return txt;                              // slug-PT SEM espelho EN → vira texto (sem link órfão)
      else if (u.startsWith("/") && !u.endsWith("/") && !u.includes("#") && !/\.[a-z0-9]+$/i.test(u)) u += "/";
      const ok = u.startsWith("/articles/") ? EN_SLUGS.has(u.slice(10).replace(/\/$/, "")) || u === "/articles/" : true;
      return ok ? `<a href="${u}">${txt}</a>` : txt;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
}

// ─── corpo markdown → HTML. Trata: AD_SLOT (→ div vazia CLS-safe), # H1 (ignora; vem do frontmatter), ### sub,
//     ## sec, blockquote, listas, parágrafos. A linha *Continue a história:…* e o CTA *O Radar lê…* viram .rel/itálico. ───
function renderBody(body) {
  const lines = body.split("\n");
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map(mdInline).join(" ")}</p>`); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    // AD_SLOT → div vazia, altura reservada (sem script de anúncio)
    const ad = t.match(/^<!--\s*AD_SLOT\s+id="([^"]+)".*-->/i);
    if (ad) { flush(); out.push(`<div class="ad-slot" data-ad-slot="${esc(ad[1])}" style="min-height:90px;margin:18px 0"></div>`); continue; }
    if (t.startsWith("<!--")) { continue; }                      // outros comentários: descarta
    if (t === "") { flush(); continue; }
    if (/^#\s/.test(t)) { flush(); continue; }                   // H1 vem do frontmatter
    if (/^###\s/.test(t)) { flush(); out.push(`<h2 class="sub">${esc(t.replace(/^###\s+/, ""))}</h2>`); continue; }  // seções do cânone do episódio = h2 (eram h3 → salto h1→h3); .sub mantém o visual editorial
    if (/^##\s/.test(t)) { flush(); out.push(`<h2 class="sec">${esc(t.replace(/^##\s+/, ""))}</h2>`); continue; }
    if (t.startsWith(">")) {
      flush(); const q = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) { q.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      i--;
      out.push(`<blockquote class="ex">${q.filter(Boolean).map(mdInline).join("<br>")}</blockquote>`);
      continue;
    }
    if (/^[-•]\s/.test(t)) {
      flush(); const items = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-•]\s/, "")); i++; }
      i--;
      out.push("<ul>" + items.map((x) => `<li>${mdInline(x)}</li>`).join("") + "</ul>");
      continue;
    }
    // linha "Continue a história:" / CTA "O Radar lê…" (itálico inteiro) → .rel relacionada
    if (/^\*.+\*$/.test(t)) { flush(); out.push(`<p class="rel">${mdInline(t.replace(/^\*|\*$/g, ""))}</p>`); continue; }
    para.push(t);
  }
  flush();
  return out.join("\n");
}

// meta description: 1ª frase do 1º parágrafo de prosa, clamp ~155c
function deriveDesc(body) {
  for (const ln of body.split("\n")) {
    const t = ln.trim();
    if (!t || t.startsWith("#") || t.startsWith("<!--") || t.startsWith(">") || /^\*.+\*$/.test(t) || /^[-•]\s/.test(t)) continue;
    let s = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*?([^*]+)\*\*?/g, "$1");
    const dot = s.indexOf(". ");
    if (dot > 40 && dot < 155) s = s.slice(0, dot + 1);
    if (s.length > 158) s = s.slice(0, 158).replace(/\s+\S*$/, "").replace(/[\s,.;:—–-]+$/, "") + "…";
    return s;
  }
  return "Um episódio do arquivo do Radar Perene — o que a leitura registrou, e o que aconteceu depois.";
}

// ─── chrome estático (copiado verbatim de gen_pages.mjs p/ paridade visual total) ───
const PG_CSS = '<style>.pg{max-width:760px;margin:0 auto;padding:8px 0 20px}.pg h1{font-family:var(--serif);font-weight:500;font-size:clamp(28px,4.4vw,42px);line-height:1.14;margin:18px 0 22px;letter-spacing:-.01em}.pg h2.sec{margin-top:30px;font-size:clamp(19px,2.6vw,24px)}.pg h2.sub,.pg h3.sub{margin-top:22px;font-size:16.5px;color:var(--txt)}.pg p{font-size:15.5px;color:var(--txt2);margin:0 0 15px}.pg .rel{font-size:13px;color:var(--dim)}.pg .rel a:not(.btn),.pg p a:not(.btn){color:var(--gold-ink)}.pg .livestate{font-family:var(--mono);font-size:12px;color:var(--dim);background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:10px 13px}.pg .ctarow{margin:22px 0 6px}.pg ol,.pg ul{color:var(--txt2);font-size:15px;padding-left:22px;margin:0 0 15px}.pg ol li,.pg ul li{margin:5px 0}.pg blockquote.ex{margin:6px 0 16px;padding:12px 15px;border-left:2px solid var(--gold);background:var(--surface2);border-radius:0 9px 9px 0;font-size:14px;color:var(--txt2);font-style:italic}.pg table.tb{width:100%;border-collapse:collapse;margin:6px 0 18px;font-size:13.5px}.pg table.tb th,.pg table.tb td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);color:var(--txt2);vertical-align:top}.pg table.tb th{color:var(--txt);font-weight:600;border-bottom:1.5px solid var(--line)}.pg .closing{font-family:var(--serif);font-size:17px;color:var(--txt);margin-top:24px;font-style:italic}.pg pre.api{background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:11px 13px;overflow:auto;font-size:12px}.pg .ad-slot{}.pg .artlist{list-style:none;padding:0;margin:8px 0 22px}.pg .artlist li{margin:0 0 16px;padding-bottom:14px;border-bottom:1px solid var(--line)}.pg .artlist a{color:var(--txt);font-family:var(--serif);font-size:18px;text-decoration:none}.pg .artlist a:hover{color:var(--gold-ink)}.pg .artlist .ds{display:block;font-size:13.5px;color:var(--dim);margin-top:4px}.pg .tag{display:inline-block;font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}.crumb{font-size:12px;color:var(--dim);margin:6px 0 0}.crumb a{color:var(--gold-ink)}footer .ftnav{font-size:12.5px;line-height:2;color:var(--dim);margin:0 0 12px}footer .ftnav a{color:var(--dim);text-decoration:none}footer .ftnav a:hover{color:var(--gold-ink)}.brand .logo-w{display:block;height:35px;width:auto}:root[data-theme="dark"] .logo-w-light{display:none}:root:not([data-theme="dark"]) .logo-w-dark{display:none}</style>';
// site-kit (favicons/ícones/manifest) + logo real (wordmark light/dark, LOGO_IMG) — paridade total com a home.
// (logo-bússola antiga BRAND_SVG removida 2026-06-19: a marca usa LOGO_IMG)
const SITE_KIT = '<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n<link rel="icon" type="image/svg+xml" href="/icon-light.svg" media="(prefers-color-scheme: light)">\n<link rel="icon" type="image/svg+xml" href="/icon-dark.svg" media="(prefers-color-scheme: dark)">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#131521">\n<link rel="manifest" href="/site.webmanifest">';
const LOGO_IMG = '<img class="logo-w logo-w-light" src="/logo-light.svg" alt="Radar Perene" width="139" height="35"><img class="logo-w logo-w-dark" src="/logo-dark.svg" alt="Radar Perene" width="139" height="35">';
const THEME_JS = '<script>(function(){try{var t=localStorage.getItem("rp-theme");if(t!=="light"&&t!=="dark")t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}var tg=document.getElementById("theme-tg");if(tg)tg.onclick=function(){var c=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",c);try{localStorage.setItem("rp-theme",c);}catch(e){}};})();</script>';
const FOOT_PT = '<a href="/artigos/">Artigos</a> · <a href="/metodologia/">Metodologia</a> · <a href="/como-ler-o-radar/">Como ler</a> · <a href="/conceitos/">Conceitos</a> · <a href="/lentes/">Lentes</a> · <a href="/diario">Diário</a> · <a href="/free/">Versão grátis</a> · <a href="/ativos">Ativos</a> · <a href="/founder/">Institucional</a> · <a href="/sobre">Sobre</a> · <a href="/termos/">Termos</a> · <a href="/privacidade/">Privacidade</a>';
const FOOT_EN = '<a href="/articles/">Articles</a> · <a href="/methodology/">Methodology</a> · <a href="/how-to-read-the-radar/">How to read</a> · <a href="/concepts/">Concepts</a> · <a href="/lenses/">Lenses</a> · <a href="/diario">Daily</a> · <a href="/free/">Free</a> · <a href="/ativos">Assets</a> · <a href="/founder/">Institutional</a> · <a href="/about">About</a> · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a>';
// CTA de conversão no fim de cada página de conteúdo (episódio/comparativo/conceito) → landing por idioma (/assine·/subscribe)
const CTA_PT = '<div class="ctarow" style="border-top:1px solid var(--line);margin-top:32px;padding-top:22px"><p class="closing" style="font-style:normal;margin:0 0 14px">Isto é a memória do Radar. A leitura de hoje — regime, 5 lentes e os análogos do dia — está no ar, de graça.</p><a class="btn" href="/">Ver a leitura de hoje</a><a class="btn ghost" href="/assine">Assinar o Perene Semanal · R$ 29/mês →</a></div>';
const CTA_EN = '<div class="ctarow" style="border-top:1px solid var(--line);margin-top:32px;padding-top:22px"><p class="closing" style="font-style:normal;margin:0 0 14px">This is the Radar&rsquo;s memory. Today&rsquo;s reading — regime, 5 lenses and the day&rsquo;s analogs — is live, free.</p><a class="btn" href="/">See today&rsquo;s reading</a><a class="btn ghost" href="/subscribe">Subscribe to Perene Semanal · US$ 29/mo →</a></div>';
const DISC = "O Radar Perene fornece inteligência regulatória contextualizada. Não constitui parecer jurídico, contábil, econômico ou de investimento.";
const DISC_EN = "Radar Perene provides contextual regulatory intelligence. Nothing here constitutes legal, accounting, economic, or investment advice.";
const ORIGIN = "https://radarperene.com.br";       // gêmeo PT
const ORIGIN_EN = "https://radarperene.com";       // gêmeo EN
const LASTMOD = "2026-06-17";

const ldScript = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
// Entidade (invariante §10): Org sameAs = SÓ o gêmeo de locale. founder = @id da Pessoa CANÔNICA
// no brazilcomplexity (consolidação cross-site; não redefine a Person localmente).
const FOUNDER_REF = { "@id": "https://brazilcomplexity.com/about.html#person" };
const orgLd = { "@context": "https://schema.org", "@type": "Organization", "@id": ORIGIN + "/#org", "name": "Radar Perene", "url": ORIGIN, "logo": ORIGIN + "/og.png", "sameAs": ["https://radarperene.com"], "founder": FOUNDER_REF, "description": "Inteligência regulatória brasileira lida como dado — leitura de regime, intermercado e contexto." };
const orgLdEn = { "@context": "https://schema.org", "@type": "Organization", "@id": ORIGIN_EN + "/#org", "name": "Radar Perene", "url": ORIGIN_EN, "logo": ORIGIN_EN + "/og.png", "sameAs": ["https://radarperene.com.br"], "founder": FOUNDER_REF, "description": "Brazilian regulatory intelligence read as data — regime, intermarket and context." };

// shell de página, lang-aware. `alt` = { pt, en } com paths absolutos p/ hreflang (en só presente quando há espelho).
// canonical = próprio origin/idioma; x-default = PT (mercado primário/gêmeo PT).
function pageHtml({ lang = "pt", path, title, desc, crumb, h1, bodyHtml, schemas, alt }) {
  const en = lang === "en";
  const origin = en ? ORIGIN_EN : ORIGIN, canon = origin + path;
  const ld = [ldScript(en ? orgLdEn : orgLd), ...schemas.map(ldScript)].join("\n");
  const hreflang = [];
  if (alt && alt.pt) hreflang.push(`<link rel="alternate" hreflang="pt-br" href="${alt.pt}">`);
  if (alt && alt.en) hreflang.push(`<link rel="alternate" hreflang="en" href="${alt.en}">`);
  hreflang.push(`<link rel="alternate" hreflang="x-default" href="${alt && alt.pt ? alt.pt : canon}">`);
  return `<!doctype html>
<html lang="${en ? "en" : "pt-BR"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Radar Perene">
<meta property="og:locale" content="${en ? "en_US" : "pt_BR"}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${en ? "https://radarperene.com/og-image-1200x630-en.png" : "https://radarperene.com.br/og-image-1200x630.png"}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${en ? "https://radarperene.com/og-image-1200x630-en.png" : "https://radarperene.com.br/og-image-1200x630.png"}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
${SITE_KIT}
${hreflang.join("\n")}
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
    <p class="crumb">${crumb}</p>
    <h1>${esc(h1)}</h1>
    ${bodyHtml}
  </article>
</div>
</main>
<footer>
  <nav class="ftnav">${en ? FOOT_EN : FOOT_PT}</nav>
  <p class="disc">${esc(en ? DISC_EN : DISC)}</p>
  <p>© Radar Perene · <a href="/" style="color:var(--gold-ink)">${en ? "radarperene.com" : "radarperene.com.br"}</a></p>
</footer>
${THEME_JS}
<script src="/ads.js" defer></script>
</body>
</html>`;
}

function writeFile(relDir, html) {
  const dir = join(ROOT, relDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
}

const TIPO_LABEL = { episodio: "Episódio", conceito: "Conceito", comparativo: "Comparativo" };
const CAMADA_LABEL = { marquee: "Marquee", derivado: "Derivado", episodio: "Episódio", conceito: "Conceito", comparativo: "Comparativo" };
const CAMADA_LABEL_EN = { marquee: "Marquee", derivado: "Derivative", episodio: "Episode", conceito: "Concept", comparativo: "Comparison" };
// meta description EN: mesma heurística do deriveDesc, fallback EN
function deriveDescEn(body) {
  for (const ln of body.split("\n")) {
    const t = ln.trim();
    if (!t || t.startsWith("#") || t.startsWith("<!--") || t.startsWith(">") || /^\*.+\*$/.test(t) || /^[-•]\s/.test(t)) continue;
    let s = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*?([^*]+)\*\*?/g, "$1");
    const dot = s.indexOf(". ");
    if (dot > 40 && dot < 155) s = s.slice(0, dot + 1);
    if (s.length > 158) s = s.slice(0, 158).replace(/\s+\S*$/, "").replace(/[\s,.;:—–-]+$/, "") + "…";
    return s;
  }
  return "An episode from the Radar Perene archive — what the reading registered, and what happened next.";
}
const dateOf = (a) => a.meta.criado_em || LASTMOD;

const urls = [];     // p/ sitemap (PT, .com.br)
const urlsEn = [];   // p/ sitemap (EN, .com) — com par PT p/ hreflang recíproco

// ─── a) página por artigo (PT sempre; EN quando há espelho .en.md) ───
let nArt = 0, nArtEn = 0;
for (const a of ARTS) {
  const title = a.meta.titulo || a.slug;
  const desc = deriveDesc(a.body);
  const camada = CAMADA_LABEL[a.meta.camada] || CAMADA_LABEL[a.meta.tipo] || "Artigo";
  const path = "/artigos/" + a.slug + "/";
  const e = EN_BY_SLUG[a.slug];                       // espelho EN (ou undefined)
  const enPath = e ? "/articles/" + e.slugEn + "/" : null;
  const altPt = ORIGIN + path, altEn = e ? ORIGIN_EN + enPath : null;

  // ── PT ──
  CUR_LANG = "pt";
  let bodyHtml = `<p class="crumb-tag tag">${esc(camada)}</p>\n` + renderBody(a.body);
  const conts = [...new Set([...(a.meta.links_continue || []), ...(a.meta.episodios_relacionados || [])])].filter((s) => SLUGS.has(s));
  if (conts.length) {
    const links = conts.map((s) => `<a href="/artigos/${s}/">${esc(BY_SLUG[s].meta.titulo || s)}</a>`).join(" · ");
    bodyHtml += `\n<p class="rel" style="margin-top:24px">Leia também: ${links}</p>`;
  }
  const pers = personagensDe(a).filter((p) => PERSONAGEM_NOME[p]);
  if (pers.length) {
    const plinks = pers.map((p) => `<a href="/artigos/personagem/${p}/">${esc(PERSONAGEM_NOME[p])}</a>`).join(" · ");
    bodyHtml += `\n<p class="rel">Personagens: ${plinks}</p>`;
  }
  bodyHtml += `\n${CTA_PT}`;
  const crumb = `<a href="/">Radar Perene</a> / <a href="/artigos/">Artigos</a> / ${esc(camada.toLowerCase())}`;
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
    { "@type": "ListItem", position: 1, name: "Início", item: ORIGIN + "/" },
    { "@type": "ListItem", position: 2, name: "Artigos", item: ORIGIN + "/artigos/" },
    { "@type": "ListItem", position: 3, name: title, item: ORIGIN + path },
  ] };
  const article = { "@context": "https://schema.org", "@type": a.meta.tipo === "conceito" ? "DefinedTerm" : "Article",
    "headline": title, "name": title, "description": desc, "url": ORIGIN + path, "inLanguage": "pt-BR",
    "datePublished": dateOf(a), "dateModified": LASTMOD,
    "author": { "@type": "Organization", "name": "Radar Perene" },
    "publisher": { "@type": "Organization", "name": "Radar Perene", "url": ORIGIN } };
  if (a.meta.tipo === "conceito") article.inDefinedTermSet = { "@type": "DefinedTermSet", "name": "A enciclopédia dos regimes do Radar Perene", "url": ORIGIN + "/artigos/" };
  writeFile("artigos/" + a.slug, pageHtml({ lang: "pt", path, title, desc, crumb, h1: title, bodyHtml, schemas: [breadcrumb, article], alt: { pt: altPt, en: altEn } }));
  urls.push({ path, pri: a.meta.camada === "marquee" ? "0.8" : "0.7", altEn });
  nArt++;

  // ── EN (espelho) ──
  if (e) {
    CUR_LANG = "en";
    const titleEn = e.meta.title || e.slugEn;
    const descEn = deriveDescEn(e.body);
    const camadaEn = CAMADA_LABEL_EN[a.meta.camada] || CAMADA_LABEL_EN[a.meta.tipo] || "Article";
    let bodyHtmlEn = `<p class="crumb-tag tag">${esc(camadaEn)}</p>\n` + renderBody(e.body);
    // "Read also" do frontmatter EN (links_continue já em slugs-EN; valida contra EN_SLUGS)
    const contsEn = [...new Set([...(e.meta.links_continue || []), ...(e.meta.episodios_relacionados || [])])].filter((s) => EN_SLUGS.has(s));
    if (contsEn.length) {
      const links = contsEn.map((s) => { const tgt = Object.values(EN_BY_SLUG).find((x) => x.slugEn === s); return `<a href="/articles/${s}/">${esc(tgt ? (tgt.meta.title || s) : s)}</a>`; }).join(" · ");
      bodyHtmlEn += `\n<p class="rel" style="margin-top:24px">Read also: ${links}</p>`;
    }
    if (pers.length) {
      const plinks = pers.map((p) => `<a href="/articles/character/${PERSONAGEM_SLUG_EN[p]}/">${esc(PERSONAGEM_NOME_EN[p])}</a>`).join(" · ");
      bodyHtmlEn += `\n<p class="rel">Characters: ${plinks}</p>`;
    }
    bodyHtmlEn += `\n${CTA_EN}`;
    const crumbEn = `<a href="/">Radar Perene</a> / <a href="/articles/">Articles</a> / ${esc(camadaEn.toLowerCase())}`;
    const breadcrumbEn = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN_EN + "/" },
      { "@type": "ListItem", position: 2, name: "Articles", item: ORIGIN_EN + "/articles/" },
      { "@type": "ListItem", position: 3, name: titleEn, item: ORIGIN_EN + enPath },
    ] };
    const articleEn = { "@context": "https://schema.org", "@type": a.meta.tipo === "conceito" ? "DefinedTerm" : "Article",
      "headline": titleEn, "name": titleEn, "description": descEn, "url": ORIGIN_EN + enPath, "inLanguage": "en",
      "datePublished": dateOf(a), "dateModified": LASTMOD,
      "author": { "@type": "Organization", "name": "Radar Perene" },
      "publisher": { "@type": "Organization", "name": "Radar Perene", "url": ORIGIN_EN } };
    if (a.meta.tipo === "conceito") articleEn.inDefinedTermSet = { "@type": "DefinedTermSet", "name": "The Radar Perene encyclopedia of regimes", "url": ORIGIN_EN + "/articles/" };
    writeFile("articles/" + e.slugEn, pageHtml({ lang: "en", path: enPath, title: titleEn, desc: descEn, crumb: crumbEn, h1: titleEn, bodyHtml: bodyHtmlEn, schemas: [breadcrumbEn, articleEn], alt: { pt: altPt, en: altEn } }));
    urlsEn.push({ path: enPath, pri: a.meta.camada === "marquee" ? "0.8" : "0.7", altPt });
    nArtEn++;
  }
  CUR_LANG = "pt";
}

// ─── b) hub /artigos/ ───
const marquees = ARTS.filter((a) => a.meta.camada === "marquee");
const families = [...new Set(ARTS.map((a) => a.meta.familia))].filter(Boolean).sort();
const FAMILIA_NOME = { "2011": "2011 — crise europeia", "2013": "2013 — taper tantrum", "2015": "2015 — os três alarmes",
  "2016": "2016 — o fundo", "2018": "2018 — caminhoneiros e eleição", "2022": "2022 — a casa às escuras", covid: "COVID — março de 2020", transversal: "Conceitos transversais" };
const FAMILIA_NOME_EN = { "2011": "2011 — European crisis", "2013": "2013 — taper tantrum", "2015": "2015 — the three alarms",
  "2016": "2016 — the bottom", "2018": "2018 — truckers and election", "2022": "2022 — the house in the dark", covid: "COVID — March 2020", transversal: "Transversal concepts" };
function hubHtml() {
  let b = `<div class="ad-slot" data-ad-slot="topo" style="min-height:90px;margin:18px 0"></div>\n`;
  b += `<p>O arquivo do Radar lido como uma enciclopédia: o que a leitura registrou num momento de regime — e o que o mercado fez depois. Sem previsão, sem chamada de compra. Apenas o extremo, com data, e o veredito honesto do que veio em seguida.</p>\n`;

  b += `<h2 class="sec">Os marquees — os grandes regimes</h2>\n<ul class="artlist">\n`;
  for (const a of marquees) {
    b += `<li><span class="tag">${esc(FAMILIA_NOME[a.meta.familia] || a.meta.familia)}</span><a href="/artigos/${a.slug}/">${esc(a.meta.titulo)}</a><span class="ds">${esc(deriveDesc(a.body))}</span></li>\n`;
  }
  b += `</ul>\n<div class="ad-slot" data-ad-slot="meio" style="min-height:90px;margin:18px 0"></div>\n`;

  b += `<h2 class="sec">Por família de regime</h2>\n`;
  for (const fam of families) {
    const fa = ARTS.filter((a) => a.meta.familia === fam && a.meta.tipo !== "conceito");
    if (!fa.length) continue;
    b += `<h3 class="sub">${esc(FAMILIA_NOME[fam] || fam)}</h3>\n<ul class="artlist">\n`;
    for (const a of fa) b += `<li><span class="tag">${esc(CAMADA_LABEL[a.meta.camada] || a.meta.tipo)}</span><a href="/artigos/${a.slug}/">${esc(a.meta.titulo)}</a></li>\n`;
    b += `</ul>\n`;
  }

  b += `<h2 class="sec">Navegue por personagem</h2>\n<p>Os termômetros e razões que se repetem em todo regime. Cada personagem reúne os episódios em que foi protagonista.</p>\n<ul class="artlist">\n`;
  for (const p of Object.keys(PERSONAGEM_NOME)) {
    const list = POR_PERSONAGEM[p] || [];
    if (!list.length) continue;
    b += `<li><a href="/artigos/personagem/${p}/">${esc(PERSONAGEM_NOME[p])}</a><span class="ds">${list.length} ${list.length === 1 ? "página" : "páginas"}</span></li>\n`;
  }
  b += `</ul>\n<div class="ad-slot" data-ad-slot="rodape" style="min-height:90px;margin:18px 0"></div>\n`;
  b += `<p class="rel" style="margin-top:24px">O Radar lê esses regimes todos os dias. <a href="/diario">Veja a leitura de hoje →</a> · <a href="/metodologia/">Como o método funciona →</a></p>`;
  b += `\n${CTA_PT}`;
  return b;
}
const hubTitle = "A enciclopédia dos regimes — Radar Perene";
const hubDesc = "O arquivo do Radar lido como enciclopédia: o que a leitura registrou em cada regime de mercado — e o que aconteceu depois. Marquees, episódios, conceitos e comparativos.";
const hubSchema = { "@context": "https://schema.org", "@type": "CollectionPage", "name": "A enciclopédia dos regimes", "description": hubDesc, "url": ORIGIN + "/artigos/", "inLanguage": "pt-BR" };
CUR_LANG = "pt";
const hubAlt = { pt: ORIGIN + "/artigos/", en: ORIGIN_EN + "/articles/" };   // o hub EN sempre existe (espelho do hub)
writeFile("artigos", pageHtml({ lang: "pt", path: "/artigos/", title: hubTitle, desc: hubDesc, crumb: `<a href="/">Radar Perene</a> / artigos`, h1: "A enciclopédia dos regimes", bodyHtml: hubHtml(), schemas: [hubSchema], alt: hubAlt }));
urls.push({ path: "/artigos/", pri: "0.8", altEn: hubAlt.en });

// ─── b-EN) hub /articles/ — só lista o que tem espelho EN (parcial enquanto a esteira escala) ───
const ENL = (a) => EN_BY_SLUG[a.slug];   // artigo PT que tem espelho
function hubHtmlEn() {
  CUR_LANG = "en";
  let b = `<div class="ad-slot" data-ad-slot="topo" style="min-height:90px;margin:18px 0"></div>\n`;
  b += `<p>The Radar's archive read as an encyclopedia: what the reading registered at a moment of regime — and what the market did next. No forecast, no buy call. Only the extreme, with a date, and the honest verdict of what followed.</p>\n`;
  const marqueesEn = marquees.filter(ENL);
  if (marqueesEn.length) {
    b += `<h2 class="sec">The marquees — the major regimes</h2>\n<ul class="artlist">\n`;
    for (const a of marqueesEn) { const e = ENL(a); b += `<li><span class="tag">${esc(FAMILIA_NOME_EN[a.meta.familia] || a.meta.familia)}</span><a href="/articles/${e.slugEn}/">${esc(e.meta.title)}</a><span class="ds">${esc(deriveDescEn(e.body))}</span></li>\n`; }
    b += `</ul>\n`;
  }
  b += `<div class="ad-slot" data-ad-slot="meio" style="min-height:90px;margin:18px 0"></div>\n`;
  b += `<h2 class="sec">By regime family</h2>\n`;
  for (const fam of families) {
    const fa = ARTS.filter((a) => a.meta.familia === fam && a.meta.tipo !== "conceito" && ENL(a));
    if (!fa.length) continue;
    b += `<h3 class="sub">${esc(FAMILIA_NOME_EN[fam] || fam)}</h3>\n<ul class="artlist">\n`;
    for (const a of fa) { const e = ENL(a); b += `<li><span class="tag">${esc(CAMADA_LABEL_EN[a.meta.camada] || a.meta.tipo)}</span><a href="/articles/${e.slugEn}/">${esc(e.meta.title)}</a></li>\n`; }
    b += `</ul>\n`;
  }
  // personagens com pelo menos 1 episódio EN
  const persWithEn = Object.keys(PERSONAGEM_NOME).filter((p) => (POR_PERSONAGEM[p] || []).some(ENL));
  if (persWithEn.length) {
    b += `<h2 class="sec">Browse by character</h2>\n<p>The thermometers and ratios that recur in every regime. Each character gathers the episodes in which it was the protagonist.</p>\n<ul class="artlist">\n`;
    for (const p of persWithEn) {
      const n = (POR_PERSONAGEM[p] || []).filter(ENL).length;
      b += `<li><a href="/articles/character/${PERSONAGEM_SLUG_EN[p]}/">${esc(PERSONAGEM_NOME_EN[p])}</a><span class="ds">${n} ${n === 1 ? "page" : "pages"}</span></li>\n`;
    }
    b += `</ul>\n`;
  }
  b += `<div class="ad-slot" data-ad-slot="rodape" style="min-height:90px;margin:18px 0"></div>\n`;
  b += `<p class="rel" style="margin-top:24px">The Radar reads these regimes every day. <a href="/diario">See today's reading →</a> · <a href="/methodology/">How the method works →</a></p>`;
  b += `\n${CTA_EN}`;
  return b;
}
const hubTitleEn = "The encyclopedia of regimes — Radar Perene";
const hubDescEn = "The Radar's archive read as an encyclopedia: what the reading registered in each market regime — and what happened next. Marquees, episodes, concepts and comparisons.";
const hubSchemaEn = { "@context": "https://schema.org", "@type": "CollectionPage", "name": "The encyclopedia of regimes", "description": hubDescEn, "url": ORIGIN_EN + "/articles/", "inLanguage": "en" };
const hubBodyEn = hubHtmlEn();
writeFile("articles", pageHtml({ lang: "en", path: "/articles/", title: hubTitleEn, desc: hubDescEn, crumb: `<a href="/">Radar Perene</a> / articles`, h1: "The encyclopedia of regimes", bodyHtml: hubBodyEn, schemas: [hubSchemaEn], alt: hubAlt }));
urlsEn.push({ path: "/articles/", pri: "0.8", altPt: hubAlt.pt });
CUR_LANG = "pt";

// ─── c) hubs de personagem (PT sempre; EN /articles/character/{p_en}/ quando há ≥1 episódio EN do personagem) ───
const order = { marquee: 0, comparativo: 1, derivado: 2, episodio: 2, conceito: 3 };
const personHubs = [], personHubsEn = [];
for (const p of Object.keys(PERSONAGEM_NOME)) {
  const list = POR_PERSONAGEM[p] || [];
  if (!list.length) continue;
  const nome = PERSONAGEM_NOME[p];
  const verbete = CONCEITO_DE_PERSONAGEM[p];   // slug do conceito (se houver)
  const path = "/artigos/personagem/" + p + "/";
  const pEn = PERSONAGEM_SLUG_EN[p];
  const enPath = "/articles/character/" + pEn + "/";
  const hasEnHub = list.some(ENL) || (verbete && EN_BY_SLUG[verbete]);
  const altPt = ORIGIN + path, altEn = hasEnHub ? ORIGIN_EN + enPath : null;
  const sorted = [...list].sort((x, y) => (order[x.meta.camada] ?? 9) - (order[y.meta.camada] ?? 9) || (x.meta.titulo || "").localeCompare(y.meta.titulo || ""));

  // ── PT ──
  CUR_LANG = "pt";
  let b = `<div class="ad-slot" data-ad-slot="topo" style="min-height:90px;margin:18px 0"></div>\n`;
  if (ESTUDO_INTRO[p]) b += `<p class="lead">${ESTUDO_INTRO[p].pt}</p>\n`;
  if (verbete && BY_SLUG[verbete]) {
    b += `<p>${mdInline(deriveDesc(BY_SLUG[verbete].body))}</p>\n`;
    b += `<p class="rel"><a href="/artigos/${verbete}/">Ler o verbete completo: ${esc(BY_SLUG[verbete].meta.titulo)} →</a></p>\n`;
  } else {
    b += `<p>Todas as páginas do arquivo em que <strong>${esc(nome)}</strong> aparece como personagem do regime.</p>\n`;
  }
  b += `<h2 class="sec">Onde ${esc(nome)} aparece</h2>\n<ul class="artlist">\n`;
  for (const a of sorted) {
    if (a.slug === verbete) continue;
    b += `<li><span class="tag">${esc(CAMADA_LABEL[a.meta.camada] || a.meta.tipo)}</span><a href="/artigos/${a.slug}/">${esc(a.meta.titulo)}</a></li>\n`;
  }
  b += `</ul>\n<div class="ad-slot" data-ad-slot="rodape" style="min-height:90px;margin:18px 0"></div>\n`;
  b += `<p class="rel" style="margin-top:22px"><a href="/artigos/">← Voltar à enciclopédia</a> · <a href="/diario">A leitura de hoje →</a></p>`;
  b += `\n${CTA_PT}`;
  const title = `Personagem: ${nome} — Radar Perene`;
  const desc = `Todos os episódios e conceitos do arquivo do Radar em que ${nome} é protagonista do regime de mercado.`;
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
    { "@type": "ListItem", position: 1, name: "Início", item: ORIGIN + "/" },
    { "@type": "ListItem", position: 2, name: "Artigos", item: ORIGIN + "/artigos/" },
    { "@type": "ListItem", position: 3, name: "Personagem: " + nome, item: ORIGIN + path },
  ] };
  const coll = { "@context": "https://schema.org", "@type": "CollectionPage", "name": "Personagem: " + nome, "description": desc, "url": ORIGIN + path, "inLanguage": "pt-BR" };
  writeFile("artigos/personagem/" + p, pageHtml({ lang: "pt", path, title, desc, crumb: `<a href="/">Radar Perene</a> / <a href="/artigos/">Artigos</a> / personagem`, h1: "Personagem: " + nome, bodyHtml: b, schemas: [breadcrumb, coll], alt: { pt: altPt, en: altEn } }));
  urls.push({ path, pri: "0.6", altEn });
  personHubs.push({ p, nome, count: sorted.filter((a) => a.slug !== verbete).length });

  // ── EN ──
  if (hasEnHub) {
    CUR_LANG = "en";
    const nomeEn = PERSONAGEM_NOME_EN[p];
    const verbeteEn = verbete && EN_BY_SLUG[verbete] ? EN_BY_SLUG[verbete] : null;
    let be = `<div class="ad-slot" data-ad-slot="topo" style="min-height:90px;margin:18px 0"></div>\n`;
    if (ESTUDO_INTRO[p]) be += `<p class="lead">${ESTUDO_INTRO[p].en}</p>\n`;
    if (verbeteEn) {
      be += `<p>${mdInline(deriveDescEn(verbeteEn.body))}</p>\n`;
      be += `<p class="rel"><a href="/articles/${verbeteEn.slugEn}/">Read the full entry: ${esc(verbeteEn.meta.title)} →</a></p>\n`;
    } else {
      be += `<p>Every page of the archive in which <strong>${esc(nomeEn)}</strong> appears as a character of the regime.</p>\n`;
    }
    be += `<h2 class="sec">Where ${esc(nomeEn)} appears</h2>\n<ul class="artlist">\n`;
    for (const a of sorted) {
      const e = ENL(a); if (!e || a.slug === verbete) continue;
      be += `<li><span class="tag">${esc(CAMADA_LABEL_EN[a.meta.camada] || a.meta.tipo)}</span><a href="/articles/${e.slugEn}/">${esc(e.meta.title)}</a></li>\n`;
    }
    be += `</ul>\n<div class="ad-slot" data-ad-slot="rodape" style="min-height:90px;margin:18px 0"></div>\n`;
    be += `<p class="rel" style="margin-top:22px"><a href="/articles/">← Back to the encyclopedia</a> · <a href="/diario">Today's reading →</a></p>`;
    be += `\n${CTA_EN}`;
    const titleEn = `Character: ${nomeEn} — Radar Perene`;
    const descEn = `Every episode and concept in the Radar's archive in which ${nomeEn} is the protagonist of the market regime.`;
    const breadcrumbEn = { "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
      { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN_EN + "/" },
      { "@type": "ListItem", position: 2, name: "Articles", item: ORIGIN_EN + "/articles/" },
      { "@type": "ListItem", position: 3, name: "Character: " + nomeEn, item: ORIGIN_EN + enPath },
    ] };
    const collEn = { "@context": "https://schema.org", "@type": "CollectionPage", "name": "Character: " + nomeEn, "description": descEn, "url": ORIGIN_EN + enPath, "inLanguage": "en" };
    writeFile("articles/character/" + pEn, pageHtml({ lang: "en", path: enPath, title: titleEn, desc: descEn, crumb: `<a href="/">Radar Perene</a> / <a href="/articles/">Articles</a> / character`, h1: "Character: " + nomeEn, bodyHtml: be, schemas: [breadcrumbEn, collEn], alt: { pt: altPt, en: altEn } }));
    urlsEn.push({ path: enPath, pri: "0.6", altPt });
    personHubsEn.push({ pEn, nomeEn });
  }
  CUR_LANG = "pt";
}

// ─── d) sitemap: funde /artigos/** (PT) e /articles/** (EN) no sitemap-pages.xml, com hreflang recíproco ───
const SP = join(ROOT, "sitemap-pages.xml");
let spXml = readFileSync(SP, "utf8");
// linha de URL c/ hreflang: PT sempre; EN quando há par; x-default → PT (gêmeo primário)
const su = (loc, pri, ptAlt, enAlt) => {
  const alts = [];
  if (ptAlt) alts.push(`<xhtml:link rel="alternate" hreflang="pt-br" href="${ptAlt}"/>`);
  if (enAlt) alts.push(`<xhtml:link rel="alternate" hreflang="en" href="${enAlt}"/>`);
  alts.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${ptAlt || loc}"/>`);
  return `<url><loc>${loc}</loc>${alts.join("")}<lastmod>${LASTMOD}</lastmod><changefreq>monthly</changefreq><priority>${pri}</priority></url>`;
};
// remove blocos /artigos/ e /articles/ pré-existentes (idempotência) e injeta os novos antes de </urlset>
spXml = spXml.replace(/<url><loc>https:\/\/radarperene\.com\.br\/artigos\/[^<]*<\/loc>.*?<\/url>\n?/g, "");
spXml = spXml.replace(/<url><loc>https:\/\/radarperene\.com\/articles\/[^<]*<\/loc>.*?<\/url>\n?/g, "");
const ptRows = urls.map((u) => su(ORIGIN + u.path, u.pri, ORIGIN + u.path, u.altEn || null));
const enRows = urlsEn.map((u) => su(ORIGIN_EN + u.path, u.pri, u.altPt || null, ORIGIN_EN + u.path));
const newRows = [...ptRows, ...enRows].join("\n");
spXml = spXml.replace("</urlset>", newRows + "\n</urlset>");
writeFileSync(SP, spXml);
// sitemap.xml estático = espelho do sitemap-pages.xml (gen_pages mantém os 2 em sync)
writeFileSync(join(ROOT, "sitemap.xml"), spXml);

// ─── validação de links internos órfãos (PT contra SLUGS; EN contra EN_SLUGS) ───
let orphans = 0;
for (const a of ARTS) {
  for (const s of [...(a.meta.links_continue || []), ...(a.meta.episodios_relacionados || [])]) {
    if (!SLUGS.has(s)) { console.log(`  ⚠ link órfão PT em ${a.slug}: → ${s}`); orphans++; }
  }
}
let orphansEn = 0;
for (const e of Object.values(EN_BY_SLUG)) {
  for (const s of [...(e.meta.links_continue || []), ...(e.meta.episodios_relacionados || [])]) {
    // EN link válido se: é slug-EN existente, OU slug-PT que ainda não tem espelho (degrada p/ texto, não é órfão de rota)
    if (EN_SLUGS.has(s)) continue;
    if (SLUGS.has(s)) continue;   // slug-PT sem espelho → vira texto (mdInline), aceitável enquanto a esteira escala
    console.log(`  ⚠ link órfão EN em ${e.slugEn}: → ${s}`); orphansEn++;
  }
}

// ─── relatório ───
console.log("✓ páginas de artigo PT:", nArt, "· EN:", nArtEn);
console.log("✓ hub /artigos/: 1 · hub /articles/: 1");
console.log("✓ hubs de personagem PT:", personHubs.length, "· EN:", personHubsEn.length);
for (const h of personHubs) console.log(`    /artigos/personagem/${h.p.padEnd(20)} ${h.nome.padEnd(28)} ${h.count} episódios`);
for (const h of personHubsEn) console.log(`    /articles/character/${h.pEn.padEnd(22)} ${h.nomeEn}`);
console.log("✓ URLs no sitemap (PT /artigos/**:", urls.length, "· EN /articles/**:", urlsEn.length + ")");
console.log(orphans ? `\n⚠ ${orphans} link(s) interno(s) órfão(s) PT` : "\n✓ nenhum link interno órfão PT");
console.log(orphansEn ? `⚠ ${orphansEn} link(s) interno(s) órfão(s) EN` : "✓ nenhum link interno órfão EN (links EN resolvem a slug-EN existente ou degradam a texto)");
