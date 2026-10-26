// Shared Playwright helpers: static server + iPhone-like page with touch.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png' };

export function serve(dir = path.join(ROOT, 'dist'), port = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(dir, u === '/' ? 'index.html' : u);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        res.writeHead(404);
        return res.end('nf');
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(port, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

export const VIEWPORTS = {
  iphone14: { width: 390, height: 844, deviceScaleFactor: 3 },
  iphoneSE: { width: 375, height: 667, deviceScaleFactor: 2 },
  iphoneMax: { width: 430, height: 932, deviceScaleFactor: 3 },
};

export async function launch(vp = 'iphone14', opts = {}) {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const v = VIEWPORTS[vp];
  const ctx = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    deviceScaleFactor: opts.dsf ?? 1, // render cheaper in software GL; layout is identical
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall due to ReadPixels')) errors.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  return { browser, ctx, page, errors };
}

/** Drag from (x,y) by (dx,dy) holding for ms, via touch-like pointer events. */
export async function drag(page, x, y, dx, dy, ms) {
  await page.evaluate(
    ([x, y, dx, dy]) => {
      const el = document.getElementById('play');
      const ev = (type, cx, cy) =>
        new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true, isPrimary: true });
      el.dispatchEvent(ev('pointerdown', x, y));
      window.dispatchEvent(ev('pointermove', x + dx * 0.5, y + dy * 0.5));
      window.dispatchEvent(ev('pointermove', x + dx, y + dy));
    },
    [x, y, dx, dy],
  );
  await page.waitForTimeout(ms);
  await page.evaluate(
    ([x, y]) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })),
    [x + dx, y + dy],
  );
}
