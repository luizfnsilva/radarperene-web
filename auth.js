/* auth.js — boot de sessão/Founder compartilhado pelas páginas da Biblioteca do Assinante.
   Replica a lógica provada do index.html: Supabase Auth (implicit) + /api/v1/me → premium/rank,
   selo "Membro Fundador #x", menu de login (Google + magic link), e expõe:
     window.RP_PREMIUM (bool), window.RP_TOKEN (access_token | null)
     window.RP_AUTH = { sb, ANON, EN, token(), login(), ready }
   Dispara o evento "rp-premium-change" sempre que o estado muda — as páginas escutam para
   (re)carregar o conteúdo gateado. Requer /vendor/supabase-js/supabase.min.js carregado antes. */
(function () {
  if (!window.supabase) return;
  var SBU = "https://zcjtkgltrxdnlacezpny.supabase.co";
  var ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjanRrZ2x0cnhkbmxhY2V6cG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTk3MDQsImV4cCI6MjA5NTc5NTcwNH0.CkEmnGCSTfF-9FjjebyeBUFV0-vW6CsfpyBea6cLCUs";
  var sb = window.supabase.createClient(SBU, ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
  var EN = location.search.indexOf("lang=en") >= 0 || location.hostname === "radarperene.com";
  var seal = document.getElementById("me-seal");
  var loginEl = document.getElementById("me-login");
  var bibEl = document.getElementById("me-biblioteca");
  var token = null;

  function fire() { try { window.dispatchEvent(new Event("rp-premium-change")); } catch (x) {} }

  async function refresh() {
    var sess = (await sb.auth.getSession()).data.session;
    if (!sess) {
      if (loginEl) loginEl.textContent = (EN ? "Sign in" : "Entrar");
      if (seal) seal.style.display = "none";
      if (bibEl) bibEl.style.display = "none";
      window.RP_PREMIUM = false; window.RP_TOKEN = null; token = null; fire(); return;
    }
    if (loginEl) { loginEl.textContent = (EN ? "Sign out" : "Sair"); loginEl.title = sess.user.email || ""; }
    token = sess.access_token;
    try {
      var r = await fetch(location.origin + "/api/v1/me", { headers: { apikey: ANON, Authorization: "Bearer " + token } });
      var d = await r.json();
      if (d && d.premium) {
        window.RP_PREMIUM = true; window.RP_TOKEN = token;
        if (seal && d.rank) { seal.style.display = "inline-block"; seal.textContent = (EN ? "Founding Member #" : "Membro Fundador #") + d.rank; }
        if (bibEl) bibEl.style.display = "inline";
      } else {
        window.RP_PREMIUM = false; window.RP_TOKEN = null;
        if (seal) seal.style.display = "none";
        if (bibEl) bibEl.style.display = "none";
      }
    } catch (e) {}
    fire();
  }

  function openLogin() {
    var old = document.getElementById("me-menu"); if (old) { old.remove(); return; }
    var m = document.createElement("div"); m.id = "me-menu";
    m.style.cssText = "position:absolute;top:46px;right:14px;z-index:10000;background:#13171c;border:1px solid #222a31;border-radius:10px;padding:7px;box-shadow:0 12px 40px rgba(0,0,0,.55);min-width:200px";
    var prov = function (p) { return function () { sb.auth.signInWithOAuth({ provider: p, options: { redirectTo: location.origin + location.pathname + location.search } }); }; };/* ★ sem location.hash: fragmento (ex.: /#radar) gera hash duplo no retorno (/#radar#access_token=…) e o detectSessionInUrl não lê o token → "volta deslogado" */
    var GSVG = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/><path fill="#4CAF50" d="M24 43.5c5.2 0 9.8-2 13.3-5.2l-6.2-5.2C29.1 34.7 26.7 35.5 24 35.5c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.2 5.2C40.9 36.8 43.5 31 43.5 24c0-1.3-.1-2.3-.4-3.5z"/></svg>';
    var gb = document.createElement("button");
    gb.innerHTML = GSVG + '<span>' + (EN ? "Continue with Google" : "Continuar com Google") + '</span>';
    gb.style.cssText = "display:flex;align-items:center;justify-content:center;gap:9px;width:100%;background:#fff;color:#1f1f1f;border:1px solid #2a323c;border-radius:8px;padding:11px;margin-bottom:6px;cursor:pointer;font:13px 'Inter',system-ui,sans-serif;font-weight:600";
    gb.onmouseover = function () { gb.style.background = "#eef0f2"; }; gb.onmouseout = function () { gb.style.background = "#fff"; };
    gb.onclick = prov("google"); m.appendChild(gb);
    var ml = document.createElement("button");
    ml.textContent = (EN ? "Email magic link" : "Link por e-mail");
    ml.style.cssText = "display:block;width:100%;text-align:left;background:transparent;border:0;color:#e8ebee;padding:9px 11px;border-radius:7px;cursor:pointer;font:13px 'Inter',system-ui,sans-serif";
    ml.onmouseover = function () { ml.style.background = "#1c222b"; }; ml.onmouseout = function () { ml.style.background = "transparent"; };
    ml.onclick = async function () {
      m.remove();
      var em = (prompt(EN ? "Your email:" : "Seu e-mail:") || "").trim().toLowerCase();
      if (!em) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { alert(EN ? "Invalid email format." : "Formato de e-mail inválido."); return; }
      var res = await sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin + location.pathname + location.search, shouldCreateUser: true } });
      alert(res.error ? ("Erro: " + res.error.message) : (EN ? "Check your email for the link (and spam)." : "Verifique seu e-mail — enviamos o link (veja o spam também)."));
    };
    m.appendChild(ml);
    document.body.appendChild(m);
    setTimeout(function () { document.addEventListener("click", function h(ev) { if (!m.contains(ev.target) && ev.target !== loginEl) { m.remove(); document.removeEventListener("click", h); } }); }, 50);
  }

  if (loginEl) loginEl.addEventListener("click", async function (e) {
    e.preventDefault();
    var sess = (await sb.auth.getSession()).data.session;
    if (sess) { await sb.auth.signOut(); location.reload(); return; }
    openLogin();
  });

  window.RP_AUTH = { sb: sb, ANON: ANON, EN: EN, token: function () { return token; }, login: openLogin, ready: refresh() };
  sb.auth.onAuthStateChange(function () { refresh(); });
})();
