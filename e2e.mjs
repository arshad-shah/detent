import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('file://' + process.cwd() + '/playground/index.html');
await page.waitForTimeout(1200);

/** Drag from one locator to a point, in small steps like a real hand. */
async function dragBy(locator, dx, dy, steps = 18, grabX = 40) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const b = await locator.boundingBox();
  const x = b.x + Math.min(grabX, b.width / 2);
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
}

const results = {};

// 1. Reorder within a list.
const order = () => page.$$eval('#list-basic li', (els) => els.map((e) => e.dataset.label));
results['list before'] = (await order()).slice(0, 3).join(', ');
await dragBy(page.locator('#list-basic li').first(), 0, 130);
results['list after'] = (await order()).slice(0, 3).join(', ');

// 2. Move a card across board columns.
await page.locator('#board').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const cardBox = await page.locator('#board-root .column').nth(0).locator('li').first().boundingBox();
const emptyBox = await page.locator('#board-root .column').nth(2).locator('.list').boundingBox();
await dragBy(
  page.locator('#board-root .column').nth(0).locator('li').first(),
  emptyBox.x + 60 - (cardBox.x + 40),
  emptyBox.y + 20 - (cardBox.y + cardBox.height / 2),
);
results['board counts'] = (await page.$$eval('#board-root em', (e) => e.map((x) => x.textContent))).join('/');

// 3. Resize the hero card from its corner.
await page.locator('#free').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const hero = await page.locator('#hero-card').boundingBox();
await page.mouse.move(hero.x + hero.width - 4, hero.y + hero.height - 4);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(hero.x + hero.width - 4 + i * 5, hero.y + hero.height - 4 + i * 3);
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForTimeout(200);
results['hero after resize'] = (await page.locator('#hero-readout').textContent()).replace(/\s+/g, ' ').trim();

// 4. Bounds: shove the caged card hard into a corner.
await dragBy(page.locator('#bounds-card'), -900, -900, 12, 20);
results['bounds offset'] = await page.locator('#bounds-card').evaluate((el) => el.style.transform);

// 5. Grid snap.
await dragBy(page.locator('#grid-card'), 47, 33, 12, 20);
results['grid offset'] = await page.locator('#grid-card').evaluate((el) => el.style.transform);

// 6. Axis lock.
await dragBy(page.locator('#axis-card'), 60, 60, 12, 20);
results['axis offset'] = await page.locator('#axis-card').evaluate((el) => el.style.transform);

// 7. Grip only: dragging the body must not move it, the button must still click.
const gripCard = page.locator('#grip-card');
await gripCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
const gb = await gripCard.boundingBox();
await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(gb.x + gb.width / 2 + i * 8, gb.y + gb.height / 2); await page.waitForTimeout(16); }
await page.mouse.up();
results['body drag moved it'] = (await gripCard.evaluate((el) => el.style.transform)) || 'no';
await page.locator('#grip-button').click();
results['button clicks'] = (await page.locator('#grip-readout').textContent()).trim();

// 8. Escape cancels.
await page.locator('#axis-card').scrollIntoViewIfNeeded();
const beforeEsc = await page.locator('#axis-card').evaluate((el) => el.style.transform);
const ab = await page.locator('#axis-card').boundingBox();
await page.mouse.move(ab.x + 20, ab.y + 20);
await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(ab.x + 20 + i * 6, ab.y + 20); await page.waitForTimeout(16); }
await page.keyboard.press('Escape');
await page.mouse.up();
await page.waitForTimeout(150);
results['escape restored'] = (await page.locator('#axis-card').evaluate((el) => el.style.transform)) === beforeEsc ? 'yes' : 'no';

// 9. Keyboard reorder.
await page.locator('#key-list li').first().focus();
for (const key of ['Space', 'ArrowDown', 'ArrowDown', 'Space']) await page.keyboard.press(key);
results['keyboard order'] = (await page.$$eval('#key-list li', (e) => e.map((x) => x.dataset.label))).slice(0, 3).join(', ');

// 10. Auto-scroll inside the long list.
await page.locator('#long').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const scroller = page.locator('#long-list');
const sb = await scroller.boundingBox();
const firstRow = await scroller.locator('li').first().boundingBox();
await page.mouse.move(firstRow.x + 40, firstRow.y + firstRow.height / 2);
await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(firstRow.x + 40, firstRow.y + 20 + i * 20); await page.waitForTimeout(20); }
await page.mouse.move(firstRow.x + 40, sb.y + sb.height - 12);
await page.waitForTimeout(700);
await page.mouse.up();
results['long list scrolled'] = (await scroller.evaluate((el) => el.scrollTop)) > 0 ? 'yes' : 'no';

// 10b. Reorder while the list auto-scrolls: the item must land where the
// pointer is, and stay under the pointer the whole way down.
await page.locator('#long').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
{
  await scroller.evaluate((e) => (e.scrollTop = 0));
  await page.waitForTimeout(150);
  const box = await scroller.boundingBox();
  const first = await scroller.locator('li').first().boundingBox();
  const label = await scroller.locator('li').first().evaluate((e) => e.dataset.label);
  await page.mouse.move(first.x + 40, first.y + first.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(first.x + 40, first.y + 20 + i * 20); await page.waitForTimeout(20); }
  await page.mouse.move(first.x + 40, box.y + box.height - 14);
  await page.waitForTimeout(900);
  const held = await page.evaluate(() => {
    const el = document.querySelector('#long-list .dk-sorting');
    const b = el.getBoundingClientRect();
    return { mid: b.top + b.height / 2 };
  });
  results['tracks pointer while scrolling'] = Math.abs(held.mid - (box.y + box.height - 14)) < 20 ? 'yes' : 'no';
  const scrolled = await scroller.evaluate((e) => e.scrollTop);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const landed = await page.$$eval('#long-list li', (els, l) => els.findIndex((x) => x.dataset.label === l), label);
  results['scroll-drag landed at'] = `${landed} (scrolled ${scrolled}px)`;
  results['scroll-drag moved far'] = landed > 6 ? 'yes' : 'no';
}

// 10c. The same thing when the page scrolls rather than the list.
{
  await page.locator('#reorder').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const label = await page.locator('#list-basic li').first().evaluate((e) => e.dataset.label);
  const first = await page.locator('#list-basic li').first().boundingBox();
  await page.mouse.move(first.x + 40, first.y + first.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(first.x + 40, first.y + 25 + i * 12); await page.waitForTimeout(16); }
  await page.mouse.wheel(0, 220);
  await page.waitForTimeout(200);
  const drift = await page.evaluate(() => {
    const el = document.querySelector('#list-basic .dk-sorting');
    return el ? el.getBoundingClientRect().top : null;
  });
  await page.mouse.move(first.x + 40, first.y + 25 + 6 * 12 + 1);
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(250);
  results['survives page scroll'] = drift !== null && Math.abs(drift - (first.y + 25 + 72 - first.height / 2)) < 60 ? 'yes' : 'no';
  results['still ordered after'] = (await page.$$eval('#list-basic li', (e) => e.map((x) => x.dataset.label))).length === 5 ? 'yes' : 'no';
}

// 10d. Resizable must not inject children when you supply your own handles.
{
  const injected = await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;width:120px;height:80px';
    host.innerHTML = '<span class="mine"></span>';
    document.body.appendChild(host);
    const before = host.children.length;
    detent.resizable(host, { handles: { se: '.mine' } });
    const after = host.children.length;
    host.remove();
    return after - before;
  });
  results['supplied handles add children'] = injected === 0 ? 'no' : `yes (${injected})`;
}

// 11. Canvas panel drag + resize.
await page.locator('#canvas').scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await dragBy(page.locator('.widget').first().locator('.widget-bar'), 90, 40, 14, 30);
results['canvas readout'] = (await page.locator('#canvas-readout').textContent()).replace(/\s+/g, ' ').trim().slice(0, 60);

for (const [k, v] of Object.entries(results)) console.log(k.padEnd(22), v);
console.log('page errors:'.padEnd(22), errors.length ? errors : 'none');

await page.locator('#free').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/01-top.png' });
await page.locator('#reorder').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/02-lists.png' });
await page.locator('#canvas').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: 'shots/03-canvas.png' });
await browser.close();
