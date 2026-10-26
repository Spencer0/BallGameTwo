// Save/progress survives a reload in the real page: finish L1, reload, check unlock + collection + settings.
import { serve, launch } from './harness.mjs';
const { srv, url } = await serve();
const { browser, page, errors } = await launch('iphone14');
await page.goto(`${url}?level=1&mode=timed&auto=1&sim=12&q=low`);
await page.waitForFunction(() => window.__game?.session?.reachedTarget, null, { timeout: 600000, polling: 1000 });
await page.evaluate(() => { window.__game.setSetting('music', 0.33); window.__game.finish(); });
await page.waitForSelector('.results-screen.in', { timeout: 20000 });
const before = await page.evaluate(() => ({ unlocked: window.__game.save.data.unlocked, seen: Object.keys(window.__game.save.data.seen).length, stars: window.__game.save.totalStars() }));
await page.goto(url); // reload without test params
await page.waitForSelector('.title-screen.in', { timeout: 60000 });
const after = await page.evaluate(() => ({ unlocked: window.__game.save.data.unlocked, seen: Object.keys(window.__game.save.data.seen).length, stars: window.__game.save.totalStars(), music: window.__game.save.data.settings.music }));
await page.tap('[data-act=play]');
await page.waitForSelector('.levels-screen.in');
const card2 = await page.$eval('.level-card[data-i="1"]', (e) => e.dataset.act);
const ok = after.unlocked === 2 && before.unlocked === 2 && after.seen === before.seen && after.seen > 10 && after.stars >= 1 && after.music === 0.33 && card2 === 'level' && !errors.length;
console.log(ok ? 'ok ' : 'BAD', 'persist', JSON.stringify({ before, after, card2 }), errors.join(' | '));
await browser.close();
srv.close();
process.exit(ok ? 0 : 1);
