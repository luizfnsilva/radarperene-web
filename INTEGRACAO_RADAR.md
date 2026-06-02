# Integração do Radar Perene — para qualquer site (auto-atualiza, identidade própria)

A gente **hospeda**; você **consome**. O dado atualiza sozinho (motor recalcula ao longo do dia).
Escolha UMA das três formas. Todas com **CORS aberto**, grátis, P7 (descritivo, nunca recomenda).

> Base da API: `https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api`
> (quando `radarperene.com` estiver no ar, os scripts/iframe migram pra lá e nada do seu lado muda.)

---

## Forma 1 — `radar.js` (recomendada: 1 linha, SUA identidade, qualquer site)
Funciona em HTML puro, WordPress, Wix, React, etc. Você estiliza com **variáveis CSS** — fica com a SUA cara.

```html
<div id="radar-perene" data-lang="pt"></div>
<script src="https://radarperene.com/radar.js" defer></script>
```

**Deixar com a identidade do seu site** — defina as variáveis no container (ou no `:root`):
```html
<style>
  #radar-perene{
    --rp-accent:#0aa3a3;   /* sua cor de marca */
    --rp-bg:#ffffff; --rp-txt:#111; --rp-card:#f5f6f7; --rp-card2:#eef0f2;
    --rp-line:#e2e5e8; --rp-dim:#667; --rp-font:'Poppins',sans-serif;
    --rp-radius:16px; --rp-max:900px;
  }
</style>
```
Tudo opcional — sem CSS, usa o tema escuro/dourado padrão. `data-lang="en"` para inglês.

---

## Forma 2 — API JSON (controle total: renderize do seu jeito)
Para quem quer integrar no próprio front-end / app / newsletter, em qualquer linguagem.

```
GET https://zcjtkgltrxdnlacezpny.supabase.co/functions/v1/radar-api/v1/digest?lang=pt
```
Retorna a leitura de HOJE (resumo do formato):
```json
{
  "data_referencia": "2026-06-01",
  "radar": {
    "regime": { "brasil": {"regime":"...", "score": 26.9}, "global": {...}, "br_intermercado": {...} },
    "macro_essencial": [ {"nome":"Juro real ex-ante","valor":7.18,"unidade":"% a.a."}, ... ],
    "intermercado_br": [ {"nome":"Commodities / IBOV","z":1.81,"regime":"alto"}, ... ]
  },
  "vertice": {
    "termometros": [ {"code":"ai_bubble","nome":"Bolha de IA","valor":80.6,"regime":"extremo alto"}, ... (9) ],
    "divergencias": [ {"codigo":"DV6","leitura":"..."}, ... ],
    "breadth": {"us":{"valor":12.8,"regime":"..."},"br":{...}}, "geo_riskon": {...},
    "estudo_analogo": {"pergunta":"...","mediana_ret_pct":15.49,"base_rate_pct":6.81,"delta_pp":8.68,"hit_rate_pct":98,"n_analogos":49}
  },
  "premium": {...}, "disclaimer": {"pt":"...","en":"..."}
}
```
`?lang=en` traduz tudo. Endpoints parciais: `/v1/radar`, `/v1/vertice`.

---

## Forma 3 — iframe (mais simples; visual nosso)
Para colar em minutos, sem renderizar nada. (Visual padrão Radar Perene; não herda sua identidade.)
```html
<iframe src="https://radarperene.com/radar-embed.html?lang=pt" style="width:100%;border:0;min-height:1250px" loading="lazy" title="Radar Perene"></iframe>
```

---

## Regras (P7 — proteja a fonte e a si mesmo)
- É **conteúdo educacional/informativo**, **descritivo** — **nunca** apresentar como recomendação de compra/venda. O disclaimer vem no payload; mantenha-o visível.
- **Cite a fonte** (link para `radarperene.com`) — é o combinado do uso gratuito (e gera o backlink).
- Não remova o disclaimer nem reescreva os números.

## Por que isso atende o requisito
- **Auto-atualiza:** o dado é buscado ao vivo; o `radar.js`/iframe são servidos por nós → melhoramos pra todos sem ninguém re-subir nada.
- **Identidade própria:** `radar.js` tematiza por CSS; a API JSON você renderiza 100% no seu estilo.
- **Qualquer site:** `radar.js` (1 linha) e a API (HTTP) funcionam em qualquer stack.

*Dúvidas: hello@brazilcomplexity.com*
