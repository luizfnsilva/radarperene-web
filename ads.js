/* ads.js — injetor de anúncios AdSense GATEADO pelo plano Founder, compartilhado pelo ACERVO
   (capítulos /artigos, conceitos, metodologia, diário, /ativos). NUNCA é incluído na home,
   nos CTAs, em /assine·/subscribe, em /founder nem no checkout — esses não têm anúncio (doutrina).

   Regra de ouro (verificada): ASSINANTE LOGADO NÃO VÊ ANÚNCIO — e sem "flash":
     1) localStorage rp_premium === "1"  → Founder conhecido: zero anúncio, nem carrega o loader.
     2) há sessão Supabase mas premium desconhecido → resolve /api/v1/me ANTES de injetar
        (cobre o Founder que cai direto num capítulo vindo do Google, sessão fria).
     3) sem sessão → leitor free → injeta.
   O sinal rp_premium é o MESMO single-source-of-truth gravado no login (index.html/auth.js),
   lido também pelo rpIsPro() do radar.js.

   Política de densidade (plano do dono): por página, no máximo 1 In-article + 1 Multiplex;
   o Diário usa In-feed entre registros. Slots excedentes são colapsados (display:none).

   LGPD/AdSense (2026-07-02): o anúncio NÃO é gateado por consentimento — é fonte de renda e aparece
   para todo leitor free. O que muda conforme o consentimento é a PERSONALIZAÇÃO (o rastreamento):
     • sem "Aceitar" (padrão)  → requestNonPersonalizedAds=1 → anúncio contextual, sem cookie de perfil
       → dispensa opt-in no Brasil (não há rastreamento). Receita preservada.
     • com rp-consent="granted" → personalizado (sem o flag) → maior receita, para quem consentiu.
   O sinal é o MESMO banner rp-consent do index.html (agora cobre medição E publicidade).
   .com (UE/UK): a conformidade plena de anúncio personalizado exige a CMP certificada do Google
   (gratuita, no console do AdSense) — o padrão não-personalizado aqui é o piso seguro até ativá-la. */
(function () {
  "use strict";
  var PUB = "ca-pub-4470857367486011";
  var SBREF = "zcjtkgltrxdnlacezpny";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjanRrZ2x0cnhkbmxhY2V6cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTk3MDQsImV4cCI6MjA5NTc5NTcwNH0.CkEmnGCSTfF-9FjjebyeBUFV0-vW6CsfpyBea6cLCUs";

  // As 3 unidades criadas no painel AdSense (ca-pub-4470857367486011)
  var UNITS = {
    "in-article": '<ins class="adsbygoogle" style="display:block;text-align:center" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="' + PUB + '" data-ad-slot="5356741796"></ins>',
    "multiplex":  '<ins class="adsbygoogle" style="display:block" data-ad-format="autorelaxed" data-ad-client="' + PUB + '" data-ad-slot="7823998740"></ins>',
    "in-feed":    '<ins class="adsbygoogle" style="display:block" data-ad-format="fluid" data-ad-layout-key="-er+5o+5m-dh+4z" data-ad-client="' + PUB + '" data-ad-slot="6862270861"></ins>'
  };

  // mapeamento dos placeholders herdados (corpus authora topo/meio/rodape; worker /ativos usa .adslot)
  var TYPE_BY_ID = { topo: "in-article", meio: "in-article", rodape: "multiplex" };

  function localPro() { try { return localStorage.getItem("rp_premium") === "1"; } catch (e) { return false; } }

  // LGPD: personaliza o anúncio SÓ com consentimento explícito (rp-consent="granted", mesmo banner do GA4).
  // Sem consentimento → não-personalizado (contextual, sem cookie de perfil): anúncio aparece igual, sem rastreio.
  function adsPersonalized() { try { return localStorage.getItem("rp-consent") === "granted"; } catch (e) { return false; } }
  var npaSet = false;
  function applyNPA() {
    if (npaSet) return; npaSet = true;
    if (!adsPersonalized()) { try { (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = 1; } catch (e) {} }
  }

  // access_token da sessão Supabase SEM carregar o SDK (chave canônica do supabase-js v2)
  function sessionToken() {
    try {
      var raw = localStorage.getItem("sb-" + SBREF + "-auth-token");
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (o && (o.access_token || (o.currentSession && o.currentSession.access_token))) || null;
    } catch (e) { return null; }
  }

  function typeOf(el) {
    var t = el.getAttribute("data-ad-type");          // forma nova/explícita (futuro)
    if (t) return t;
    var id = el.getAttribute("data-ad-slot");          // herdado: topo/meio/rodape
    if (id && TYPE_BY_ID[id]) return TYPE_BY_ID[id];
    if (el.className && el.className.indexOf("adslot") >= 0) return "in-article"; // /ativos
    return null;
  }

  var loaderAdded = false;
  function loadLoader() {
    if (loaderAdded || document.getElementById("rp-adsense-loader")) return;
    loaderAdded = true;
    var s = document.createElement("script");
    s.id = "rp-adsense-loader"; s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + PUB;
    document.head.appendChild(s);
  }

  function inject() {
    var els = Array.prototype.slice.call(document.querySelectorAll(".ad-slot,.adslot,[data-ad-type]"));
    if (!els.length) return;
    var usedArticle = false, usedMultiplex = false;
    els.forEach(function (el) {
      var type = typeOf(el);
      if (type === "in-article") { if (usedArticle) { el.style.display = "none"; return; } usedArticle = true; }
      else if (type === "multiplex") { if (usedMultiplex) { el.style.display = "none"; return; } usedMultiplex = true; }
      else if (type !== "in-feed") { el.style.display = "none"; return; }
      var html = UNITS[type];
      if (!html) { el.style.display = "none"; return; }
      applyNPA();          // define não-personalizado ANTES do 1º push, se não houver consentimento (LGPD)
      loadLoader();
      el.innerHTML = html;
      el.style.minHeight = "";   // libera a altura reservada do placeholder (anúncio dimensiona sozinho)
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }

  function run() {
    if (localPro()) return;                     // Founder conhecido → nada
    var tok = sessionToken();
    if (!tok) { inject(); return; }             // sem sessão → free → injeta
    // sessão presente, premium desconhecido → resolve antes de injetar (sem flash p/ Founder)
    fetch(location.origin + "/api/v1/me", { headers: { apikey: ANON, Authorization: "Bearer " + tok } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.premium) { try { localStorage.setItem("rp_premium", "1"); } catch (e) {} }
        else inject();
      })
      .catch(function () { inject(); });          // /me indisponível → não punir o free
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
