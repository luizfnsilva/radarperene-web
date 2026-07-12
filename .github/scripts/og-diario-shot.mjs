// ★ 2026-07-12: gera os cartões OG por-/diario (1200×630) — a Prancha do Atlas do dia como a imagem que viaja no
// compartilhamento. Clona og-shot.mjs: a página-fonte /og/diario/{date} é renderizada AO VIVO pelo worker (reusa o
// único _renderPrancha); aqui só screenshotamos. Landmark-first / em lote: as datas vêm de OG_DATES (CSV) — casa com
// o drip editorial (as edições de maior valor de compartilhamento primeiro). PT + EN (host decide o idioma).
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";

const BASE_PT = process.env.OG_BASE || "https://radarperene.com.br";
const BASE_EN = process.env.OG_BASE_EN || "https://radarperene.com";
const FORCE = process.env.OG_FORCE === "1";  // re-gera mesmo se o PNG já existe (após um re-freeze do gerador)
const RE = /^\d{4}-\d{2}-\d{2}$/;
const dates = (process.env.OG_DATES || "").split(/[,\s]+/).map((d) => d.trim()).filter((d) => RE.test(d));
if (!dates.length) { console.log("OG_DATES vazio — nada a gerar (passe datas YYYY-MM-DD via env OG_DATES)."); process.exit(0); }

mkdirSync("og/diario", { recursive: true });
const browser = await chromium.launch();
const variants = [
  { base: BASE_PT, sfx: "" },     // og/diario/{date}.png     (PT)
  { base: BASE_EN, sfx: "-en" },  // og/diario/{date}-en.png  (EN)
];
let ok = 0, fail = 0, skip = 0;
for (const date of dates) {
  for (const v of variants) {
    const url = v.base + "/og/diario/" + date;
    const out = "og/diario/" + date + v.sfx + ".png";
    // a edição é IMUTÁVEL → o cartão de uma data já gerada nunca muda. Pula (a menos de OG_FORCE) → o cron diário
    //   converge p/ gerar só edições NOVAS; datas sem edição publicada (fim de semana/feriado) caem no catch abaixo.
    if (!FORCE && existsSync(out)) { skip++; continue; }
    // deviceScaleFactor 1 → PNG EXATAMENTE 1200×630 (casa com og:image:width/height; descasamento faz o X não renderizar).
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForSelector('html[data-og-ready="1"]', { timeout: 35000 });  // fontes carregadas (Newsreader/Inter)
      await page.waitForTimeout(300);
      const el = await page.$(".og");
      if (!el) throw new Error("canvas .og ausente (data sem edição publicada?)");
      await el.screenshot({ path: out });
      console.log("✓", out, "←", url); ok++;
    } catch (e) {
      console.error("✗", out, "←", url, "·", e.message); fail++;
    } finally {
      await page.close();
    }
  }
}
await browser.close();
console.log(`\n${ok} gerados · ${skip} já existiam (pulados) · ${fail} falhas`);
// falha o job só se algo foi TENTADO e NENHUM saiu (parcial/tudo-pulado não é falha)
if (ok === 0 && fail > 0) { console.error("todos falharam"); process.exit(1); }
