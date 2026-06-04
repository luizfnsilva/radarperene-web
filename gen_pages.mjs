#!/usr/bin/env node
// Gerador das páginas de conteúdo (Sprint B.2) — parseia SITE_COPY_BURST_1.md (fonte verbatim, já com
// correção "50 anos→desde 2000") e emite páginas estáticas bilíngues reusando o chrome do index.html.
// Doutrina: 1 rota por página (slug PT), conteúdo pt+en embutido, língua escolhida por hostname (.com→en, .com.br→pt).
// Links internos normalizados pro slug PT; links de pillars/conceitos inexistentes viram texto neutro (não 404).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = dirname(new URL(import.meta.url).pathname);
const COPY = readFileSync(join(ROOT, "..", "RADAR-REGULATORIO", "SITE_COPY_BURST_1.md"), "utf8");
const INDEX = readFileSync(join(ROOT, "index.html"), "utf8");

// --- chrome compartilhado: extrai o <style>…</style> + fontes + theme-script do index, p/ casar 100% ---
const headStyle = INDEX.slice(INDEX.indexOf("<link rel=\"preconnect\""), INDEX.indexOf("</head>"));

// NOTA: /sobre NÃO é gerado aqui — já existe sobre.html + about.html hand-built servindo /sobre e /about.
// A copy ghostwriter do /sobre está em SITE_COPY_BURST_1.md §2.1/2.2; p/ trocar, apague sobre.html+about.html
// e adicione { slug:"sobre", sec:["2.1","2.2"], type:"manifesto" } abaixo.
const PAGES = [
  { slug: "metodologia",          sec: ["5.1", "5.2"], type: "metodo" },
  { slug: "free",                 sec: ["4.1", "4.2"], type: "free" },
  { slug: "lentes/patrimonial",   sec: ["3.1", "3.2"], type: "lente" },
  { slug: "lentes/eleitoral",     sec: ["3.3", "3.4"], type: "lente" },
  { slug: "lentes/macro",         sec: ["3.5", "3.6"], type: "lente" },
  { slug: "lentes/institucional", sec: ["3.7", "3.8"], type: "lente" },
  { slug: "lentes/imobiliaria",   sec: ["3.9", "3.10"], type: "lente" },
  { slug: "lentes/vertice",       sec: ["3.11", "3.12"], type: "lente" },
];

// --- parser: extrai cada bloco fenced indexado por "N.M" a partir dos headings "### N.M …" ---
function parseBlocks(md) {
  const out = {};
  const lines = md.split("\n");
  let key = null, inFence = false, buf = [];
  for (const ln of lines) {
    const h = ln.match(/^###\s+(\d+\.\d+)\s/);
    if (h) { key = h[1]; continue; }
    if (ln.trim().startsWith("```")) {
      if (inFence) { if (key) out[key] = buf.join("\n"); buf = []; inFence = false; key = null; }
      else if (key) { inFence = true; buf = []; }
      continue;
    }
    if (inFence) buf.push(ln);
  }
  return out;
}
const BLOCKS = parseBlocks(COPY);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// normaliza links MD: rotas existentes viram <a>; pillars/conceitos inexistentes viram texto neutro
const EXISTING = ["/", "/sobre", "/metodologia", "/free", "/lentes/"];
function mdInline(s, lang) {
  return esc(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => {
    // normaliza EN→PT slug
    url = url.replace("/about", "/sobre").replace("/methodology", "/metodologia").replace("/lenses/", "/lentes/").replace(/#integrity/, "#integridade");
    const ok = EXISTING.some((p) => url === p || url.startsWith(p) && !url.includes("/conceitos") && !url.includes("/concepts"));
    if (url.includes("/conceitos") || url.includes("/concepts")) return txt; // pillar ainda não existe → texto puro
    return ok ? `<a href="${url}">${txt}</a>` : txt;
  });
}

// converte um bloco fenced (com marcadores <!-- … -->) em {title,desc,h1,bodyHtml,disclaimer,anchorIds}
function renderBlock(raw, lang, type) {
  const lines = raw.split("\n");
  let title = "", desc = "", h1 = "", disclaimer = "";
  const body = [];
  let i = 0;
  const nextContent = () => { while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("<!--"))) i++; return i < lines.length ? lines[i++] : ""; };
  for (i = 0; i < lines.length;) {
    const ln = lines[i];
    const t = ln.trim();
    const cm = t.match(/^<!--\s*(.*?)\s*-->$/);
    if (cm) {
      const tag = cm[1].toLowerCase();
      i++;
      if (tag.startsWith("meta title")) title = nextContent().trim();
      else if (tag.startsWith("meta desc")) desc = nextContent().trim();
      else if (tag === "h1") h1 = nextContent().trim();
      else if (tag.startsWith("h2")) {
        const idm = cm[1].match(/id="([^"]+)"/);
        const htxt = nextContent().trim();
        body.push(`<h2 class="sec"${idm ? ` id="${idm[1]}"` : ""}>${esc(htxt)}</h2>`);
      } else if (tag.startsWith("disclaimer")) { const d = []; while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("<!--")) d.push(lines[i++].trim()); disclaimer = d.join(" "); }
      else if (tag.startsWith("cta")) { const c = nextContent().trim(); if (c) body.push(`<p class="ctarow"><a class="btn" href="/#fundadores">${esc(c)}</a></p>`); }
      else if (tag.startsWith("microcopy")) { const mc = nextContent().trim(); if (mc) body.push(`<p class="methodnote">${esc(mc)}</p>`); }
      else if (tag.includes("link")) { const lk = nextContent().trim(); if (lk) body.push(`<p class="rel">${mdInline(lk, lang)}</p>`); }
      // demais comentários (sub-hero etc) → ignora o rótulo, conteúdo seguinte cai como prosa
      continue;
    }
    i++;
    if (t === "") { body.push(""); continue; }
    // linha de estado-ao-vivo do engine: [Label: {x}] · …
    if (/^\[.+\]/.test(t) && t.includes("{")) {
      const labels = t.replace(/\{[^}]*\}/g, "—");
      body.push(`<p class="livestate">${lang === "pt" ? "Ao vivo no app (fundadores)" : "Live in the app (founders)"}: ${esc(labels)}</p>`);
      continue;
    }
    if (/^GET\s+https?:\/\//.test(t) || t.startsWith("<iframe")) { body.push(`<pre class="api"><code>${esc(t)}</code></pre>`); continue; }
    if (t.startsWith("•")) { body.push(`<p class="bullet">${mdInline(t, lang)}</p>`); continue; }
    body.push(`<p>${mdInline(t, lang)}</p>`);
  }
  // colapsa parágrafos: junta linhas consecutivas não-vazias que não são tags de bloco em um <p>
  const html = [];
  let para = [];
  const flush = () => { if (para.length) { html.push(`<p>${para.join(" ")}</p>`); para = []; } };
  for (const b of body) {
    if (b === "") { flush(); continue; }
    if (b.startsWith("<p>") && b.endsWith("</p>") && !b.includes('class=')) { para.push(b.slice(3, -4)); continue; }
    flush(); html.push(b);
  }
  flush();
  return { title, desc, h1, bodyHtml: html.join("\n"), disclaimer };
}

function page(slug, sec, type) {
  const pt = renderBlock(BLOCKS[sec[0]] || "", "pt", type);
  const en = renderBlock(BLOCKS[sec[1]] || "", "en", type);
  const ptUrl = "/" + slug;
  const disc = pt.disclaimer || "O Radar Perene fornece inteligência regulatória contextualizada. Não constitui parecer jurídico, contábil, econômico ou de investimento.";
  const discEn = en.disclaimer || "Radar Perene provides contextual regulatory intelligence. Nothing here constitutes legal, accounting, economic, or investment advice.";
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title data-pt="${esc(pt.title)}" data-en="${esc(en.title)}">${esc(pt.title)}</title>
<meta name="description" id="m-desc" content="${esc(pt.desc)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article">
<meta property="og:title" id="og-t" content="${esc(pt.title)}">
<meta property="og:description" id="og-d" content="${esc(pt.desc)}">
<link rel="canonical" id="rp-canonical" href="https://radarperene.com.br${ptUrl}">
<link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br${ptUrl}">
<link rel="alternate" hreflang="en" href="https://radarperene.com${ptUrl}">
<link rel="alternate" hreflang="x-default" href="https://radarperene.com${ptUrl}">
${headStyle}
<style>
  .pg{max-width:760px;margin:0 auto;padding:8px 0 20px}
  .pg h1{font-family:var(--serif);font-weight:500;font-size:clamp(28px,4.4vw,42px);line-height:1.14;margin:18px 0 22px;letter-spacing:-.01em}
  .pg h2.sec{margin-top:30px}
  .pg p{font-size:15.5px;color:var(--txt2);margin:0 0 15px}
  .pg .rel{font-size:13px;color:var(--dim)}
  .pg .livestate{font-family:var(--mono);font-size:12px;color:var(--dim);background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:10px 13px}
  .pg .methodnote{font-size:12.5px;color:var(--dim);font-style:italic;border-left:2px solid var(--gold);padding-left:11px}
  .pg .ctarow{margin:22px 0 6px}
  .pg .bullet{margin:0 0 4px;font-size:14.5px}
  .pg ol{color:var(--txt2);font-size:15px;padding-left:22px}.pg ol li{margin:5px 0}
  .crumb{font-size:12px;color:var(--dim);margin:6px 0 0}.crumb a{color:var(--gold)}
  [data-lang]{display:none}
</style>
</head>
<body>
<div class="top">
  <a class="brand" href="/" style="text-decoration:none">
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="color:var(--dim)"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2"/><circle cx="16" cy="16" r="9" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2"/><path d="M16 16 L16 2 A14 14 0 0 1 29 13 Z" fill="#b8801f" fill-opacity="0.2"/><line x1="16" y1="16" x2="16" y2="2" stroke="#b8801f" stroke-width="1.6"/><circle cx="16" cy="16" r="2" fill="#b8801f"/></svg>
    <span class="nm">Radar <b>Perene</b></span>
  </a>
  <div class="lang"><a href="/" data-pt="" data-en="">← <span data-lang="pt">início</span><span data-lang="en">home</span></a><button id="theme-tg" class="tg" type="button" aria-label="tema">☾</button></div>
</div>
<div class="wrap">
  <article class="pg">
    <p class="crumb"><a href="/">Radar Perene</a> / <span data-lang="pt">${esc(slug.replace("lentes/", "lente "))}</span><span data-lang="en">${esc(slug.replace("lentes/", "lens "))}</span></p>
    <div data-lang="pt">
      <h1>${esc(pt.h1)}</h1>
      ${pt.bodyHtml}
    </div>
    <div data-lang="en">
      <h1>${esc(en.h1)}</h1>
      ${en.bodyHtml}
    </div>
  </article>
</div>
<footer>
  <p class="disc" data-lang="pt">${esc(disc)}</p>
  <p class="disc" data-lang="en">${esc(discEn)}</p>
  <p>© Radar Perene · <a href="/" style="color:var(--gold)">radarperene.com</a></p>
</footer>
<script>(function(){try{var t=localStorage.getItem("rp-theme");if(t!=="light"&&t!=="dark")t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();
// língua por hostname (.com→en, .com.br→pt) — bots que rodam JS recebem 1 língua; hreflang cobre o resto
(function(){var host=location.hostname.toLowerCase();var en=/radarperene\\.com$/.test(host)&&!/\\.com\\.br$/.test(host);var L=en?"en":"pt";
  document.documentElement.lang=en?"en":"pt-BR";
  document.querySelectorAll("[data-lang]").forEach(function(n){n.style.display=(n.getAttribute("data-lang")===L)?"":"none";});
  var T=document.querySelector("title");if(T&&T.getAttribute("data-"+L))document.title=T.getAttribute("data-"+L);
  ["m-desc","og-t","og-d"].forEach(function(id){var e=document.getElementById(id);});
  var d=document.getElementById("m-desc"),ot=document.getElementById("og-t"),od=document.getElementById("og-d"),T2=document.querySelector("title");
  if(en){if(d)d.content="${esc(en.desc)}";if(ot)ot.content="${esc(en.title)}";if(od)od.content="${esc(en.desc)}";}
  var c=document.getElementById("rp-canonical");if(c)c.href=location.origin+location.pathname.replace(/\\/$/,"")||location.origin+location.pathname;
  var tg=document.getElementById("theme-tg");if(tg)tg.onclick=function(){var cur=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",cur);try{localStorage.setItem("rp-theme",cur);}catch(e){}};
})();</script>
</body>
</html>`;
  const dir = join(ROOT, slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  return { slug, ptTitle: pt.title, enTitle: en.title, h1: pt.h1, paras: (pt.bodyHtml.match(/<p>/g) || []).length };
}

const results = PAGES.map((p) => page(p.slug, p.sec, p.type));

// --- sitemap.xml: home + 9 páginas em AMBOS domínios (mesma rota, língua por hostname) + hreflang ---
const LASTMOD = "2026-06-03";
const su = (loc, alt, freq, pri) => `<url><loc>${loc}</loc>${alt}<lastmod>${LASTMOD}</lastmod><changefreq>${freq}</changefreq><priority>${pri}</priority></url>`;
const aboutAlt = `<xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br/sobre"/><xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com/about"/>`;
const rows = [
  su("https://radarperene.com/", `<xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com/"/><xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br/"/>`, "daily", "1.0"),
  su("https://radarperene.com.br/", `<xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br/"/><xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com/"/>`, "daily", "1.0"),
  // /sobre + /about hand-built (não gerados aqui)
  su("https://radarperene.com.br/sobre", aboutAlt, "monthly", "0.8"),
  su("https://radarperene.com/about", aboutAlt, "monthly", "0.8"),
];
for (const p of PAGES) {
  const path = "/" + p.slug;
  const altEn = `<xhtml:link rel="alternate" hreflang="en" href="https://radarperene.com${path}"/><xhtml:link rel="alternate" hreflang="pt-br" href="https://radarperene.com.br${path}"/>`;
  rows.push(su(`https://radarperene.com${path}`, altEn, "monthly", "0.8"));
  rows.push(su(`https://radarperene.com.br${path}`, altEn, "monthly", "0.8"));
}
writeFileSync(join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join("\n")}\n</urlset>\n`);
console.log("✓ sitemap.xml:", rows.length, "URLs");
console.log("Blocos parseados:", Object.keys(BLOCKS).length);
for (const r of results) console.log(`  ✓ /${r.slug.padEnd(22)} pt:"${(r.h1 || "??").slice(0, 30)}" ${r.paras}p ${r.ptTitle ? "" : "⚠ SEM TITLE"}${r.enTitle ? "" : " ⚠ SEM EN"}`);
