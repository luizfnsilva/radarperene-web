# Direção Editorial do Diário — v1.0 (ESTÁVEL · CONGELADA)

**Status:** interface declarada **estável** em 2026-07-06. Direção de arte **congelada**.
**Referência visual:** mockup canônico (artifact `d0f60023-b77c-4723-adce-7076f94f1c1b`).
**Governa:** a geração do `/diario` público em `radarperene-web/worker.js` + páginas de conceito.

---

## Princípio

O Diário é um **jornal de referência** — uma **edição diária**, leitura de **2-3 minutos**. Não é um
dashboard (SaaS) nem uma revista (essa é a linguagem do Semanal). Personalidade por produto:
**Diário = jornal · Semanal = revista · Mensal = livro/dossiê · Vértice = ensaio/paper · Biblioteca = arquivo.**

A régua de identidade: a página deve poder ficar ao lado de uma da *The Economist / Monocle / Delayed
Gratification* sem perder o que a torna **Radar Perene** — e sem parecer Empiricus, Suno, Status Invest ou
TradingView. Parecer *Radar Perene* é o objetivo (é mais difícil, e é o ativo).

## As colunas permanentes (nomes fixos)

Todas começam com "O", soam de redação (não de algoritmo), e devem atravessar 20 anos sem datar:

- **O Pulso** — os três índices como personagens, não KPIs.
- **O Arquivo Lembra** — o coração da publicação (ver spec abaixo).
- **O Que Costuma Vir Depois** — a distribuição histórica (padrão recorrente, nunca previsão).
- **O Que Chamou Atenção Hoje** — a síntese editorial da sessão (2 frases).
- **Para a Próxima Edição** — a continuidade que cria expectativa de retorno.
- **Nesta edição** — o sumário (mantido; prepara a leitura).

## Estrutura da edição (ordem fixa)

Masthead → assinatura de regime (filete ~2px na cor do dia) → manchete → deck (subtítulo) → **Nesta edição** →
**O Pulso** (+ a chamada de divergência, com respiro) → **Publicidade** → **O Arquivo Lembra** →
**O Que Costuma Vir Depois** → **O Que Chamou Atenção Hoje** → **Publicidade** → **Para a Próxima Edição** → cólofon.

## Sistema visual

Paleta **editorial** (marfim/creme, grafite quente, azul profundo, terracota, oliva, dourado, ardósia) —
**nunca** verde/vermelho/laranja de mercado. Serifa em tudo (materialidade de livro). Cor por índice:
**Perene = azul · Ânima estrutural = terracota · Curto prazo = oliva** — sempre as mesmas, o leitor aprende sem
perceber. Movimento sutil (▴/▾/→), nunca gauge/barra/donut. Filetes e dot-leaders (não tabelas de dashboard).
**Zero box, card, badge, sombra ou cor de fundo.** Muito branco (respiração = prestígio).

## ★ O Arquivo Lembra — spec (o maior patrimônio)

Determinístico (o diário público NÃO reescreve nada). Fonte: `radar-api /v1/historico` (leituras maturadas ×
desfecho). É uma **linha do tempo do mesmo regime através do acervo** — *Há um ano · Há cinco anos · Primeira
vez no arquivo* — cada nó com **Ibovespa em pontos**, o que o arquivo indicava, o que aconteceu, e **link para
reler a edição** (`/diario/{data}`). Estrutura fixa: (1) data · (2) estado naquele dia (regime + Ibov pts) ·
(3) o que o arquivo indicava (mediana histórica) · (4) o que aconteceu (Ibov pts + %) · (5) reler.
**Regras duras:**
- **`indicava` e `aconteceu` SEMPRE na mesma janela** (nunca comparar 6m com 12m).
- **Honesto:** mostrar também as vezes que deu errado (baixa em tom **neutro**, nunca vermelho). "78% de direção
  confirmada — nem sempre para cima" constrói mais confiança que uma vitrine de acertos. Descritivo, não preditivo.

## Publicidade editorial

O AdSense **existente** fica (invariante). **Dois slots**, vestidos como espaço publicitário de revista:
filete + "Publicidade" + branco. **Zero box/cor/sombra/piscar.** Anúncio que segue a direção de arte melhora
a publicação (Monocle/National Geographic), não a interrompe.

---

## REGRA DE CONGELAMENTO

> Nenhuma mudança **estrutural** na interface do Diário por alguns meses. Só são permitidos:
> **microtipografia · espaçamento · pequenas frases (microcopy) · refinamento do ghostwriter.**
>
> Qualquer mudança visual futura só é aprovada se responder claramente a **pelo menos uma**:
> melhora a leitura? reforça a identidade editorial? fortalece a memória do leitor? aumenta a confiança?
> melhora a jornada entre edições? Se não, permanece como está.

O risco mudou: antes era *parecer SaaS*; agora é *excesso de refinamento* — mexer só porque se descobriu que
consegue. A arquitetura está resolvida.

## Onde vai a energia (as 3 frentes)

O diferencial competitivo não está na interface — está no **acervo**. Em um ano, ~250 edições; em cinco, ~1.200.
A partir daí o layout é quase irrelevante perto do valor do arquivo. Toda a energia vai para:

1. **Enriquecer o Arquivo Lembra** — maturar 3m/12m (quick-win: o Ibov é livre nesses horizontes), mais
   episódios, conexões cada vez mais naturais e auditáveis entre o presente e centenas de leituras anteriores.
2. **Fortalecer a continuidade entre edições** — memória própria do Diário (ontem → hoje → amanhã), sequência,
   expectativa de retorno. Sem previsão.
3. **Aprimorar o ghostwriter** — a voz. É onde o microcopy e a alma editorial evoluem, edição a edição.

*— Direção Editorial v1.0. Promulgada em 2026-07-06, quando o Diário deixou de parecer um site tentando parecer
uma revista e começou a parecer o Radar Perene.*
