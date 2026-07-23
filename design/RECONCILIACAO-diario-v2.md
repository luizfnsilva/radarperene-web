# Reconciliação do /diario público → design do artefato aprovado v2

**Data:** 2026-07-23 · **Artefato-alvo (spec):** `design/diario-artefato-aprovado-2026-07-06.html`
(claude.ai `diario-radar-perene` f73e1fcc, aprovado pelo dono). **Alvo:** `worker.js _renderDiarioDia`
(~913-1150) + o CSS do diário (linhas ~640-671 + `_chromeCss(...)` em ~1142 + `_DIARIO_CSS_V1`).

## Princípio (dono 2026-07-23)
O artefato aprovado É a especificação de DESIGN. **Mas o que APARECE obedece à matemática v2** — o
artefato é de 2026-07-06, anterior aos expurgos. Onde o texto do artefato conflita com a doutrina,
vence a doutrina (o worker já está, em geral, mais limpo).

## Achado honesto: o gap é de POLIMENTO, não de arquitetura
O live já tem, com as MESMAS classes/conceito: Pulso 3-colunas-personagens (`.pulse-i` perene/anima/
curto, cor por índice, movimento ▲▾→ "Hoje +N"), caixa `.arquivo`/`.arq-*` (O Arquivo Lembra com
timeline + lookback), `.diverg` (divergência), `.voz`, `.cas` (análogos "distribuição observada, não
previsão"), `.deck`, `.regime-rule` (filete com cicatrizes). A edição nº 1.000 aparece com 2 colunas
só porque o Ânima-curto estava nulo naquele dia (o 3º personagem é condicional a `_pAc`).

## PRESERVAR (features v2 do live que o artefato NÃO tem — não apagar)
- "A Paisagem do Risco" (barra de distribuição percentil).
- Prancha do Atlas (figura SVG do dia, com theming dark).
- "Edições em estado semelhante" (`_estadosSemelhantesHtml`).
- Box "Semanal temporariamente suspenso" (pivô de produto).
- Tratamento `em_calibracao` / pré-2009.
- Ads gateados (`.ad-slot` in-article/multiplex, Founder não vê) — o artefato usa `.adx` editorial;
  MANTER a mecânica de ad real, adotar o VISUAL editorial do `.adx` (filetes, sem box/cor).
- Voz do motor, memogate, hreflang, sumário/toc.

## DELTAS DE DESIGN a adotar do artefato (v1→v2, só refino visual)
1. **Pulso**: `.pulse-g` de flex(gap) → **grid 3 col** (`repeat(3,1fr)`, colapsa p/ 1 col ≤560px), cada
   `.idx` com `border-top:2px var(--cor)`, nome UPPER pequeno colorido, `.who` (identidade itálica),
   número grande (clamp 38-48px) em tinta calma, `.mv` UPPER com ▲▾→. (Worker já tem os dados/cores.)
2. **`.diverge`**: adotar o tratamento do artefato — borda-esquerda oliva + itálico + `<b>` na abertura.
   **COPY: manter a frase DETERMINÍSTICA do worker** (descritiva) — NUNCA o "que costuma anteceder uma
   decisão" do artefato (proibido P7/causalidade). Se não houver divergência saliente, não renderiza.
3. **`.arq` (O Arquivo Lembra)**: refinar para o box do artefato (borda-esq cor-regime, gradiente sutil,
   `.epi` timeline com nós, `.lookback` com filetes pontilhados, `.hit` terra / `.dn` neutro NUNCA
   vermelho). Worker já tem `.arq-*` — alinhar spacing/type ao artefato.
4. **Masthead/`.sig`/`.dateline`**: filete de regime com cicatrizes proporcionais + dateline (Edição nº,
   data editorial, regime, "há N dias") no estilo do artefato.
5. **`.toc` (Nesta Edição)**: sumário de jornal 1 linha com marcadores de leitura (`.pg`), do artefato.
6. **`.adx`**: visual editorial do anúncio (rótulo PUBLICIDADE + slot em filetes, sem box) — envolvendo
   o `.ad-slot` real.
7. **`.foot` (cólofon)**: nav + disclaimer + "Edição nº N · regime · Radar Perene" do artefato.
8. **Tipografia/paleta**: Iowan/Hoefler serif, paleta papel/tinta/regime + dark mode quente do artefato,
   aplicados sem quebrar o `_header`/chrome global nem a prancha.

## DOUTRINA — filtros obrigatórios sobre o que aparece (v2)
- **P7 / causalidade proibida**: nenhum verbo de intenção/antecipação ("antecede", "precifica",
  "aposta", "espera"); o artefato viola em `.diverge` → usar a copy determinística limpa do worker.
- **Intermercado**: só utilities pode ser lido como rotação (já garantido no motor; o deck vem do
  `composicao_editor` já purgado).
- **Recorrência/análogos**: sempre "Distribuição observada, não previsão" + link de método (worker já faz).
- **Regra do passado duas classes / vintage**: edições datadas honestas; nada retratado ressurge.
- **Sem verde/vermelho de P&L**: baixa = tinta neutra, nunca vermelho (worker/artefato já respeitam).

## Entrega
CSS/estrutura do `_renderDiarioDia` atualizados; deploy `wrangler` (fetch/merge antes); verificação
live (curl render + doutrina + dark + responsivo + prancha/ads intactos). Banca do dono (Opus) antes
do deploy. Nenhuma mudança de DADO/lógica — só apresentação.
