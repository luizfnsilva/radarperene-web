# Geração de páginas — fonte da verdade (ler antes de editar qualquer página)

> **REGRA DE OURO:** edite a **FONTE**, nunca o HTML gerado. Rodar o gerador **sobrescreve** o HTML.
> (Lição 2026-06-17: a voz nova da metodologia foi editada só no `metodologia/index.html`; um regen a
> reverteria para o texto antigo — tivemos de portá-la para os bursts. Não repita isso, ainda mais com a
> criação de páginas indo aos milhares.)

> ## ⚠️ ALERTA REGEN-REVERT — NÃO RODE OS GERADORES SOZINHO (estado em 2026-06-29)
> O reposicionamento jornal/institucional (jun-2026) corrigiu MUITA coisa **só no HTML vivo ou só no
> código do gerador, sem reconciliar a fonte**. Hoje o HTML no ar está certo, mas **um `node gen_pages.mjs`
> isolado HOJE reverteria** (verificado por git/grep, 2 workflows):
> - **GRAVE:** ressuscita "Founder Access · R$ 149/mês · 100 vagas / R$ 500 / US$ 290" na lente **Vértice**
>   (a fonte `RADAR-REGULATORIO/SITE_COPY_BURST_1.md:660-670` ainda tem o pitch antigo).
> - CTA das **12 lentes** volta a `/#fundadores` (hardcode em `gen_pages.mjs:257` **e** fonte BURST_1).
> - re-trunca **5+ metas de conceito** mid-frase (bug de chave: as descrições corretas estão no `SEO_OVERRIDE`
>   sob chave **sem** o prefixo `conceitos/` → chave morta; o gerador busca `conceitos/<slug>` e cai no fallback `clampD`).
> - **FAQPage** dos conceitos some (18 págs geradas) — `faqSchema()` só roda no ramo `type==="metodo"` (`:350`),
>   nunca `conceito` (`:351`), e o `BURST_2` não tem pares `P:/R:`.
> - some o **CTA "Perene Semanal R$ 29"** dos conceitos/metodologia/como-ler; somem os **~432 links internos**
>   artigos→/conceitos (`gen_artigos` não tem auto-linker); some a **página do ILI** e seu link no hub
>   (hand-written, fora do PAGES); volta o corpo R$149 de **/termos**, **/free** e **/api/docs**.
> **Regra operacional até reconciliar:** (1) **nunca** rodar um gerador isolado; (2) reconciliar a FONTE
> e a LÓGICA dos dois ANTES; (3) rodar **o par na ordem** `node gen_pages.mjs && node gen_artigos.mjs`;
> (4) conferir `git diff` (deve ser no-op nos itens acima; /founder fora; ILI dentro; sitemaps iguais).
> Mapa completo + sequência: `../RADAR-REGULATORIO/HANDOFF_2026-06-29_RECONCILIACAO_GERADORES_E_DEFERIDOS.md`.

## As duas esteiras estáticas (static-first; `wrangler` serve `./` via ASSETS)

| Esteira | Gera | Fonte (no repo do cérebro `../RADAR-REGULATORIO/`) | Rodar |
|---|---|---|---|
| **`gen_pages.mjs`** | páginas institucionais/conceito: `metodologia/`, `methodology/`, `conceitos/*`, `concepts/*`, `lentes/*`, `lenses/*`, `como-ler-o-radar/`, `free/`, `founder/`, `api/docs/` | `SITE_COPY_BURST_*.md` (bursts do ghostwriter) — metodologia = `BURST_4`, conceitos = `BURST_2`, etc. | `node gen_pages.mjs` |
| **`gen_artigos.mjs`** | a **enciclopédia editorial**: `artigos/{slug}/`, hub `artigos/`, hubs de personagem `artigos/personagem/{p}/` | `biblioteca/artigos/{marquee,derivados,conceitos,comparativos}/*.md` (corpus, frontmatter+markdown) | `node gen_artigos.mjs` |

Ambos reusam o **chrome do `index.html`** (head/estilo/tema) e o bloco de **sitemap** (`sitemap-pages.xml` + `sitemap.xml`; gen_artigos soma as URLs `/artigos/**`). `index.html`, `about.html` e `worker.js` são **escritos à mão** (editar direto — não são gerados).

## Como escalar (milhares de páginas)
- **Nova peça editorial** (episódio/conceito/comparativo/personagem): novo `.md` em `biblioteca/artigos/{tipo}/` no cérebro → `node gen_artigos.mjs`. Nada de HTML à mão.
- **Mudança em metodologia/conceitos/lentes:** editar o `SITE_COPY_BURST_*.md` correspondente → `node gen_pages.mjs`.
- **Voz/doutrina:** os canônicos vivem no cérebro (`CANONICO_ARQUIVO_EDITORIAL.md` governa o editorial; `prompt_editor_episodio.md` gera os episódios; `template_pagina_editorial.md` é a casca).

## Schema de entidade (invariante — ver CANONICO_ARQUIVO_EDITORIAL §10)
- `Organization.sameAs` = **só o gêmeo de locale** (`.com ↔ .com.br`). **NUNCA** `sameAs` para brazilcomplexity / aformadopatrimonio / a pessoa.
- `Organization.founder` = `Person` (`@id` `…/#founder`, `url` → `https://brazilcomplexity.com/about.html`) — a ponte de reconhecimento/autoridade, sem fundir marcas.
- Definido em: `gen_pages.mjs` (buildSchemas), `gen_artigos.mjs` (orgLd/founderLd), `index.html` (@graph). Mude nos três se mudar a regra.
- **Sem cross-links promocionais (funil) Radar↔imprints** — decisão deliberada (2026-06-17); só reconhecimento de entidade.

## Anúncios (ver §6-B)
Slots `<div class="ad-slot" data-ad-slot="...">` já reservados (vazios) nas /artigos. `RP_ADS_ENABLED` OFF até maturar + aprovar AdSense (`ads.txt` = `pub-4470857367486011`). Supressão de assinante inviolável quando ligar.
