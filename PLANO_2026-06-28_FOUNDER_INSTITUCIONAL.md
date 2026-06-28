# PLANO — Reposicionar o Founder para "acesso institucional sob convite"
**Data:** 2026-06-28 · **Para:** dev + marketing · **Repo:** `radarperene-web`
**Estratégia (contexto):** ver `RADAR-REGULATORIO/HANDOFF_2026-06-28_{COMERCIAL_ARRANJO,COMERCIAL_SOURCING,PITCH_LICENCA_FEE-BASED}.md`.

---

## Objetivo
Direcionar o produto para o modelo de **licenças/parcerias institucionais**, sem competir com os futuros parceiros. Concretamente: **tirar a venda direta do Founder** (vira "acesso institucional sob convite") e **manter o relatório Semanal R$29 público (click-and-buy)**.

## Princípio (ler antes de tocar em qualquer coisa)
1. **Cirúrgico e NÃO-agressivo.** Manter páginas, estrutura visual e **todas as URLs**. Mudar **só** a mecânica de "venda direta" do Founder.
2. **Área de assinante, gating e biblioteca: INTOCADOS.** É exatamente o que o institucional convidado vai usar para acessar os relatórios da biblioteca existente.
3. **Zero mudança de URL = zero risco de SEO.** Reusar `/founder` (não criar `/institutional`).
4. **Semanal R$29 segue público e intocado.**
5. Os produtos/links Stripe do Founder **podem continuar vivos no Stripe** — só param de ser **referenciados no site**. Não deletar nada agora (reversível).

---

## O QUE MUDA (lista cirúrgica, por arquivo — refs do audit)

### 1. `/founder/index.html` + `/founder/index.en.html` — vira a página institucional (mesma URL)
- **Remover os 2 botões de compra Stripe** (linha ~286):
  - `…buy.stripe.com/5kQ6oG3Iu40bem7asvb3q01` ("Entrar como fundador · R$ 149/mês")
  - `…buy.stripe.com/dRm28q3Iu2W7b9VeILb3q05` (anual) — e os equivalentes EN (`3cIdR8…`).
- **Trocar por UM CTA de convite:** "Acesso institucional — sob convite · Falar com a gente" (form / mailto / Calendly — ver decisões de marketing).
- **Reframe da linha ~285** (contador `2/100 contas tomadas`) → linguagem de convite (ou remover). **Reframe da linha ~284 / título (linha 6)** que cita `R$ 149/mês` → enquadramento institucional.
- **MANTER o corpo/explicação da página** — ele já descreve a profundidade do produto e vira a base do pitch institucional (usar `PITCH_LICENCA_FEE-BASED.md`).

### 2. `/assine/index.html` + `/subscribe/index.html` — manter Semanal, reframar o card Founder
- **Card Semanal (R$29):** intocado — preço + CTA Stripe (`7sY6oG…` PT / `cNi8wO…` EN) seguem.
- **Card Founder (linhas ~160-170):** já aponta para `/founder` (não para Stripe direto) → **só reframe de copy**: tirar o `R$ 149/mês` e o "assine", virar **"Acesso institucional → conheça"** apontando para `/founder`. Manter o card (não remover, "sem ser agressivo").
- Suavizar os `<title>`/description (linhas 6-7) que citam "Founder R$ 149".

### 3. `/index.html` (home) — reframar o CTA do Founder
- O CTA/seção do Founder (`#founder-home`, hero CTAs) → de "assine Founder" para **"acesso institucional / conheça"**, apontando `/founder`.
- **A lógica de tier (`body.rp-founder` / `body.rp-semanal` / visibilidade) fica INTOCADA.**
- Schema/metadata com `"price":"149"` (linhas ~3-4): suavizar (baixa prioridade, não-quebra).

### 4. `/radar.js` — o lock-upsell do conteúdo gated
- Hoje o lock aponta para o **checkout Stripe do Founder** (`5kQ6oG…` PT / `cNi00i…` EN, linhas ~28-35).
- **Parar de apontar para a compra do Founder.** Repointar: no conteúdo profundo (Founder-gated), lock → `/founder` (institucional, "conheça"); onde couber, oferecer o **Semanal R$29** (o que dá para comprar). → **decisão de marketing/operador.**

### 5. `/worker.js` — i18n / FAQ / tabelas de preço (FASE 2, não-quebra)
- Suavizar menções "R$ 149 / Founder" nas strings i18n/FAQ → "acesso institucional sob convite". Baixa prioridade; pode ir depois.

---

## O QUE NÃO MUDA (deixar explícito pro dev, pra não "consertar demais")
- **Área de assinante, `/biblioteca` (`/library`), gating** (`rpIsPro`, `RP_PREMIUM`, `RP_TOKEN`, `auth.js`, `/api/v1/me`) — **INTOCADOS.**
- **Todas as URLs/rotas** (`/founder`, `/assine`, `/subscribe`, `/diario`, `/ativo`, `/semanal`…).
- **Semanal R$29** e seu checkout Stripe.
- Produtos Stripe do Founder (ficam vivos, só não-referenciados).

---

## O mecanismo "sob convite" — a ÚNICA peça de backend
Hoje `premium` vem do Stripe. Para convidar um institucional **sem pagamento**:
- **Grant manual de `premium`** ao usuário convidado (flag no Supabase / na lógica do `/api/v1/me`) → `/api/v1/me` retorna `premium:true` (ou `tier:"institutional"`) → ele loga e usa a **área de assinante + biblioteca exatamente como hoje**.
- **Mínimo viável:** um jeito (admin) de marcar um usuário como premium sem Stripe. *(Opcional: um `tier:"institutional"` só para distinguir nas métricas — não é obrigatório; se retornar `premium:true`, o `auth.js` nem precisa mudar.)*
- **Nada no fluxo do assinante muda** — é só a *origem* do acesso (convite manual em vez de Stripe).

---

## Decisões para MARKETING + OPERADOR (não cravar no escuro)
- **Copy da página institucional** (o `/founder` reframado): base = `PITCH_LICENCA_FEE-BASED.md`.
- **Contador "X/100":** manter, remover, ou virar "vagas sob convite"? (sugestão: remover/abrandar — escassez de venda não cabe em convite).
- **Lock-upsell** aponta para Semanal (comprável) ou "fale conosco institucional"? (sugestão: Semanal onde couber; institucional no conteúdo profundo).
- **Formato do convite:** form, e-mail, Calendly, "falar com especialista"?

---

## Rollout (SEO-safe, faseado)
- **Fase 1 (essencial, ~1 PR):** founder PT/EN (tirar Stripe, pôr convite, reframe) + cards `/assine` `/subscribe` + CTA da home. Backend: habilitar **grant manual de premium**. *URLs intocadas → sem redirects → sem risco SEO.*
- **Fase 2 (polish):** suavizar i18n/FAQ no `worker.js`; ajustar lock-upsell; refinar copy institucional **com o operador**.
- Revisar no **working tree → deploy via Workers Builds**.

## Checklist do dev
- [ ] `/founder` PT+EN: remover botões Stripe → CTA convite; reframe preço/contador; **manter corpo**
- [ ] `/assine` + `/subscribe`: card Founder → "institucional → /founder" (sem preço/assine); **Semanal intocado**
- [ ] `/index.html`: CTA Founder → "conheça/institucional" (`/founder`); **lógica de tier intocada**
- [ ] `/radar.js`: lock não aponta mais para o Stripe do Founder
- [ ] **Backend:** grant manual de `premium` (sem Stripe) para usuário convidado
- [ ] `/worker.js` (fase 2): suavizar copy de preço do Founder
- [ ] **QA:** assinante Semanal **e** institucional convidado acessam a biblioteca normalmente; todas as URLs 200; **nenhuma venda direta do Founder** no site; Semanal comprável ok
