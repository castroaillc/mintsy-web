// Renders app icons for every theme into assets/icons/<theme>/ (needs Playwright: npx playwright install chromium).
// Proportions match the mobile app's original icon set.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { themes } from '../src/tokens.mjs';
import { logoPaths } from '../src/logo-paths.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const M = logoPaths.mark;
const H = M.height / M.width;

// [file, canvas size, mark x, mark y, mark width, background?, mono?]
const specs = [
  ['icon.png', 1024, 202, 352, 618, true],
  ['android-icon-foreground.png', 512, 126, 188, 260, false],
  ['android-icon-background.png', 512, 0, 0, 0, true],
  ['android-icon-monochrome.png', 432, 106, 159, 220, false, true],
  ['splash-icon.png', 400, 50, 122, 300, false],
  ['favicon.png', 48, 9, 16, 30, true],
  ['apple-touch-icon.png', 180, 36, 62, 108, true],
  ['icon-512.png', 512, 101, 176, 309, true],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, t] of Object.entries(themes)) {
  const dir = join(root, 'assets', 'icons', name);
  mkdirSync(dir, { recursive: true });
  for (const [file, size, x, y, w, bg, mono] of specs) {
    const letters = mono ? '#FFFFFF' : t.dark.foreground;
    const dot = mono ? '#FFFFFF' : t.dark.brand;
    const mark = w
      ? `<svg viewBox="0 0 ${M.width} ${M.height}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${w * H}px"><path fill="${letters}" d="${M.letters}"/><path fill="${dot}" d="${M.dot}"/></svg>`
      : '';
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent"><div style="position:relative;width:${size}px;height:${size}px;background:${bg ? t.iconBackground : 'transparent'}">${mark}</div></body></html>`);
    await page.screenshot({ path: join(dir, file), omitBackground: !bg, clip: { x: 0, y: 0, width: size, height: size } });
  }
}
await browser.close();
console.log('icons written');
