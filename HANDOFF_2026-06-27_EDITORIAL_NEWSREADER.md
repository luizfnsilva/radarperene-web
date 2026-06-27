# Handoff 2026-06-27 — Migração editorial Newsreader para o site inteiro

Sessão paralela ao catch-up de dados/billing (esse outro lado tem handoff próprio no cérebro:
`RADAR-REGULATORIO/HANDOFF_2026-06-27_CATCHUP_BILLING_E_FIXES.md`). Aqui só o **frontend**.

## O problema
Desde a virada editorial, **só a home (`index.html`)** tinha migrado para a identidade nova
(fonte **Newsreader**, botões de cantos retos sem "lift" de SaaS). CTAs e todas as demais páginas
seguiam com **Fraunces** (serif antiga) e, em assine/subscribe, o botão "startup" (radius 10px,
peso 700, `transform:translateY(-1px)` no hover).

## O que foi feito (commit `3deb10e`, no ar via Cloudflare Workers Builds)

**1. Regen do bulk (~165 páginas) — a forma certa, regen-safe.**
`gen_pages.mjs` e `gen_artigos.mjs` fazem `headStyle = INDEX.slice('<link rel="preconnect"' … '</head>')`
— **herdam o chrome do `index.html`**. Como a home já estava em Newsreader, bastou **re-rodar os dois
geradores** (`node gen_pages.mjs && node gen_artigos.mjs`) para propagar fonte/tema/botão para:
artigos/articles (+hubs de personagem), conceitos/concepts, lentes/lenses, metodologia/methodology,
como-ler/how-to-read, free, founder, api/docs, termos/terms, privacidade/privacy, widgets.
> ⚠️ **REGRA DE OURO** (ver `_GERADORES.md`): editar a FONTE, nunca o HTML gerado. Não edite páginas
> geradas à mão — um regen reverte. Mudou a identidade na home? Re-rode os geradores.

**2. Páginas hand-written (não geradas) — edição direta + `worker.js`.**
Fraunces→Newsreader em: `about.html`, `sobre.html`, `assine`, `subscribe`, `biblioteca`, `daily`,
`diario`, `semanal`, `weekly`, e o **chrome do `worker.js`** (`_chromeCss`, páginas worker-rendered:
/ativo, EN, /diario/<data>).
> ⚠️ **Pegadinha:** no `worker.js` o `--serif` usa **aspas escapadas** (`\'Fraunces\'`) — um sed que
> casa só `'Fraunces'` passa batido. Token de fonte: `family=Fraunces:opsz,wght@9..144,…` →
> `family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600`.
> `radar.js` já estava certo (`'Newsreader','Fraunces'` como fallback — não mexer).

**3. assine/subscribe — botão e des-SaaS-ificação.**
- Botão `.btn` startup → editorial: `border-radius:2px`, `font-weight:600`, `letter-spacing:.02em`,
  `transition:background .15s` (sem o lift `translateY`). Casa com a home ("publicação convida,
  software empurra").
- Pílula viva pulsante `.qtag` ("ao vivo", Bloomberg) → nota de texto discreta `.regime-note`
  (mantém o dado de regime ao vivo via JS, como link dourado com seta).
- Badges `border-radius:999px` → tag quadrada (3px) em versalete.
- **Glow** dourado `box-shadow:0 1px 24px rgba(168,101,26,.06)` do `.plan.feat` removido (a home
  reserva sombra a menus/overlays, **nunca** a card de conteúdo).
- Cards `border-radius:16px → 12px` (teto da home).
- **Mantido** o `linear-gradient(180deg,surface2,surface)` — a home usa o mesmo; NÃO é sinal de startup.

## Coexistência com a sessão paralela
Pushes lineares no `main` (o meu `3deb10e` primeiro; depois `f8d85f1` da outra sessão — fix do resumo
/diario, **só `worker.js`**; depois o bot de OG). Verificado que `f8d85f1` **não reverteu** nada do
editorial: Newsreader no `worker.js` (link + `--serif`) e `.regime-note`/Newsreader em assine/subscribe
intactos no HEAD. Working tree limpo, sincronizado com origin.
> Único "Fraunces" remanescente no repo = **comentário morto** na linha ~624 do `worker.js` (sobre
> timing de carregamento de fonte) — não é CSS, inofensivo.

## Pendências / próximos passos editoriais
- Nenhum bloqueio. Tudo no ar.
- Se a identidade da home mudar de novo: **re-rodar os 2 geradores** + repassar a lista hand-written
  acima (incluindo o `--serif` escapado do `worker.js`).
- Verificação visual pós-CDN opcional (Workers Builds ~1–3 min + cache).

Memória: `migracao-editorial-newsreader-site-2026-06-26.md` (mecanismo + lista hand-written) e a
armadilha de diagnóstico do "Hoje lembra" em `incidente-billing-gh-actions-backfill-2026-06-26.md`.
