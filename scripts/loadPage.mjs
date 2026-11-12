// How the checks load a page. They never wait for the network to go idle: in round 23 the Google Fonts
// stylesheet kept it busy for 17 s and `npm run a11y` and `npm run leakcheck` both timed out. The font
// requests are aborted instead (the page falls back to its system font stack; FONTS=1 lets them load), and
// a page is ready once it has loaded and the app has drawn into #root.

/** Abort the web-font requests of every page in `context`, unless FONTS=1. */
export async function quietFonts(context) {
  if (process.env.FONTS === '1') return;
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
}

/** Go to `url`, wait for the load event and the app's first render, then `settle` ms more. */
export async function open(page, url, settle = 300) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#root > *', { state: 'attached', timeout: 15000 });
  await page.evaluate(() => document.fonts?.ready.then(() => true));
  if (settle) await page.waitForTimeout(settle);
}
