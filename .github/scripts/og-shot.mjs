// ★ 2026-06-21 (dono): gera os cartões OG da Leitura do Radar (1200×630) a partir da página /og/leitura, ao vivo.
// 4 variantes: PT/EN × claro/escuro. Roda no GitHub Action (diário) e sobrescreve os PNGs servidos pelo worker.
import { chromium } from "playwright";

const BASE = process.env.OG_BASE || "https://radarperene.com.br";
const shots = [
  { out: "og-leitura-pt.png",      q: "?lang=pt" },
  { out: "og-leitura-pt-dark.png", q: "?lang=pt&theme=dark" },
  { out: "og-leitura-en.png",      q: "?lang=en" },
  { out: "og-leitura-en-dark.png", q: "?lang=en&theme=dark" },
];

const browser = await chromium.launch();
let fail = 0;
for (const s of shots) {
  const url = BASE + "/og/leitura" + s.q;
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    // espera o sinal de prontidão do card (frase + fontes + marca d'água)
    await page.waitForSelector('html[data-og-ready="1"]', { timeout: 35000 });
    await page.waitForTimeout(400);
    const el = await page.$(".og");
    if (!el) throw new Error("canvas .og ausente");
    await el.screenshot({ path: s.out });
    console.log("✓", s.out, "←", url);
  } catch (e) {
    fail++;
    console.error("✗", s.out, "←", url, "·", e.message);
  } finally {
    await page.close();
  }
}
await browser.close();
// falha o job só se NENHUM saiu (parcial não deve apagar os bons já commitados)
if (fail === shots.length) { console.error("todos falharam"); process.exit(1); }
