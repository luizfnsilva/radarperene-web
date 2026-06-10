# Integração do Radar Perene — para qualquer site (auto-atualiza, identidade própria)

A gente **hospeda**; você **consome**. O dado atualiza sozinho (o motor recalcula ao longo do dia) e nós
servimos o widget — você não precisa re-subir nada. Escolha UMA das três formas. Todas com **CORS aberto**,
grátis, e **P7** (descritivo, educacional, **nunca recomendação**).

> **Já no ar:** o widget e os scripts são servidos por **`radarperene.com`**. A API de dados (JSON) fica em
> **`https://radarperene.com.br/api/v1`** — mesmo domínio, sem expor a infraestrutura. Você sempre consome a
> **API do Radar**, não o backend.

> **Atalho — Leitura do dia (JSON canônico, citável):** `GET https://radarperene.com.br/api/leitura-do-dia.json`
> retorna a leitura agregada do dia (regime BR + score, regime global, lente em destaque, análogo, componentes
> visíveis, divergências, link da metodologia, disclaimer). CORS aberto, cache 4h, sem cadastro. Schema campo a
> campo, exemplos curl e os três tamanhos de widget em **`https://radarperene.com.br/api/docs`**.
> Histórico verificável (uma página por dia, desde 2000) em **`https://radarperene.com.br/diario`**.

---

## Forma 1 — `radar.js` (recomendada: 1 linha, SUA identidade, qualquer site)
Funciona em HTML puro, WordPress, Wix, React, etc. Você estiliza por **variáveis CSS** — fica com a SUA cara.

```html
<div id="radar-perene" data-lang="pt"></div>
<!-- crédito (obrigatório no uso gratuito) — link ESTÁTICO = backlink real -->
<p style="font-size:13px;color:#888">Radar de regime do Brasil, ao vivo, por <a href="https://radarperene.com">Radar Perene</a>.</p>
<script src="https://radarperene.com/radar.js" defer></script>
```

**Escolher quais seções mostrar** (opcional): `data-sections="regime,macro,intermercado,termometros,analogo,divergencias,extras"` no `<div>` (vazio = tudo).

**Deixar com a identidade do seu site** (todas as variáveis são opcionais):
```html
<style>
  #radar-perene{
    --rp-accent:#0aa3a3;        /* sua cor de marca */
    --rp-bg:#ffffff; --rp-txt:#111; --rp-card:#f5f6f7; --rp-card2:#eef0f2;
    --rp-line:#e2e5e8; --rp-dim:#667; --rp-font:'Poppins',sans-serif;
    --rp-radius:16px; --rp-max:900px;
  }
</style>
```
Sem CSS, usa o tema escuro/dourado padrão. Para inglês: `data-lang="en"`.

---

## Forma 2 — API JSON (controle total: renderize do seu jeito)
Para integrar no próprio front-end / app / newsletter, em qualquer linguagem.

```
GET https://radarperene.com.br/api/v1/digest?lang=pt
```
Retorna a leitura de HOJE (resumo do formato):
```json
{
  "data_referencia": "2026-06-01",
  "radar": {
    "regime": { "brasil": {"regime":"...","score":26.9}, "global": {...}, "br_intermercado": {...} },
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
`?lang=en` traduz tudo. Endpoints parciais: `https://radarperene.com.br/api/v1/radar`, `https://radarperene.com.br/api/v1/vertice`.

---

## Forma 3 — iframe (mais simples; visual nosso)
Cola em minutos, sem renderizar nada. (Visual padrão Radar Perene; não herda sua identidade.)
```html
<iframe src="https://radarperene.com/radar-embed.html?lang=pt" style="width:100%;border:0;min-height:1250px" loading="lazy" title="Radar Perene"></iframe>
```

---

## Regras (P7 — proteja a fonte e a si mesmo)
- **Conteúdo educacional/informativo, descritivo** — **nunca** apresentar como recomendação de compra/venda. O disclaimer vem no payload; mantenha-o visível.
- **Crédito obrigatório (e é o "preço" do uso gratuito):** mantenha o **link estático** `<a href="https://radarperene.com">Radar Perene</a>` no HTML da página (como no snippet acima) — **dofollow, sem `nofollow`**. É um link real no código-fonte (não só no widget), então conta como backlink de verdade e dá autoridade pros dois lados (você fica associado à fonte; nós ganhamos o link). Os links dentro do widget também apontam pra `radarperene.com`, mas é o estático que garante o SEO.
- Não remova o disclaimer nem reescreva os números.

## Por que atende o requisito
- **Auto-atualiza:** o dado é buscado ao vivo e o `radar.js`/iframe são servidos por nós → melhoramos pra todos sem ninguém re-subir nada.
- **Identidade própria:** `radar.js` tematiza por CSS; a API JSON você renderiza 100% no seu estilo.
- **Qualquer site:** `radar.js` (1 linha) e a API (HTTP) funcionam em qualquer stack.

*Dúvidas: hello@brazilcomplexity.com*
