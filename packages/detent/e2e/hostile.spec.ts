import { expect, test, type Page } from '@playwright/test';

/**
 * One page carrying every hazard a real site presents, with an assertion
 * each. A failure here is a bug in the library, never in the fixture.
 */

async function open(page: Page, file = 'hostile.html') {
  await page.goto(`/e2e/fixtures/${file}`);
  await page.waitForFunction(() => (window as unknown as { detentReady: boolean }).detentReady);
}

const idsIn = (selector: string) =>
  `[...document.querySelectorAll('${selector} li')].map(l => l.dataset.id)`;

/** Drag the first item of a list by an offset, in steps so every move lands. */
async function dragFirst(page: Page, selector: string, dx: number, dy: number) {
  const first = page.locator(`${selector} li`).first();
  const box = (await first.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

test.describe('hostile host page', () => {
  test.beforeEach(({ page }) => open(page));

  test('a host reset cannot detach the resize handles', async ({ page }) => {
    const handle = page.locator('#box [data-detent-handle="se"]');
    await expect(handle).toHaveCSS('position', 'absolute');
    await expect(handle).toHaveCSS('touch-action', 'none');
  });

  test('a host rule restyles handles without !important', async ({ page }) => {
    await expect(page.locator('#box [data-detent-handle="se"]')).toHaveCSS(
      'background-color',
      'rgb(255, 0, 0)',
    );
  });

  test('reordering works in a plain list', async ({ page }) => {
    await dragFirst(page, '#plain', 0, 60);
    expect(await page.evaluate(idsIn('#plain'))).toEqual(['b', 'a', 'c']);
  });

  test('the element tracks the cursor inside a scaled stage', async ({ page }) => {
    // Rows are 48 layout px, so 36 rendered px at 0.75. 40 crosses the next
    // midpoint; without scale compensation the item lags and nothing moves.
    await dragFirst(page, '#scaled-list', 0, 40);
    expect(await page.evaluate(idsIn('#scaled-list'))).toEqual(['b', 'a', 'c']);
  });

  test('an rtl row reorders the way the user drags', async ({ page }) => {
    await dragFirst(page, '#rtl', -120, 0);
    expect(await page.evaluate(idsIn('#rtl'))).toEqual(['b', 'a', 'c']);
  });

  test('auto-scroll advances despite scroll-behavior: smooth', async ({ page }) => {
    const list = page.locator('#tall');
    const box = (await list.boundingBox())!;
    const first = page.locator('#tall-list li').first();
    const item = (await first.boundingBox())!;

    await page.mouse.move(item.x + 10, item.y + item.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + box.height - 4, { steps: 6 });
    await page.waitForTimeout(400);
    const scrolled = await list.evaluate((el) => el.scrollTop);
    await page.mouse.up();

    expect(scrolled).toBeGreaterThan(0);
  });

  test('keyboard reordering works inside a shadow root', async ({ page }) => {
    await page.evaluate(() => {
      const root = document.querySelector('#shadow-host')!.shadowRoot!;
      (root.querySelector('li') as HTMLElement).focus();
    });
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');

    const order = await page.evaluate(() =>
      [...document.querySelector('#shadow-host')!.shadowRoot!.querySelectorAll('li')].map(
        (l) => (l as HTMLElement).dataset.id,
      ),
    );
    expect(order).toEqual(['b', 'a', 'c']);
  });

  test('the live region does not collide with the host document', async ({ page }) => {
    // A data attribute, not a global id, and at most one for the whole page.
    expect(await page.locator('[data-detent-live-region]').count()).toBe(1);
    expect(await page.locator('#dk-live-region').count()).toBe(0);
  });

  test('the lifted item is raised above its list siblings', async ({ page }) => {
    // The sticky header at z-index 9999 still wins; that is a documented
    // limitation of stacking contexts, asserted here so a change is noticed.
    await expect(page.locator('#chrome')).toHaveCSS('z-index', '9999');

    // Hold the element itself: a locator would re-resolve to whichever item
    // is first *after* the reorder, which is a different element.
    const item = await page.locator('#plain li').first().elementHandle();
    const box = (await item!.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 10, box.y + box.height * 1.6, { steps: 4 });
    const z = await item!.evaluate((el) => (el as HTMLElement).style.zIndex);
    await page.mouse.up();

    expect(z).toBe('20');
  });
});

test.describe('with no stylesheet loaded', () => {
  test.beforeEach(({ page }) => open(page, 'no-styles.html'));

  test('dragging and sorting still work', async ({ page }) => {
    await dragFirst(page, '#plain', 0, 60);
    expect(await page.evaluate(idsIn('#plain'))).toEqual(['b', 'a', 'c']);
  });

  test('keyboard reordering still works', async ({ page }) => {
    await page.evaluate(() => {
      const root = document.querySelector('#shadow-host')!.shadowRoot!;
      (root.querySelector('li') as HTMLElement).focus();
    });
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');

    const order = await page.evaluate(() =>
      [...document.querySelector('#shadow-host')!.shadowRoot!.querySelectorAll('li')].map(
        (l) => (l as HTMLElement).dataset.id,
      ),
    );
    expect(order).toEqual(['b', 'a', 'c']);
  });

  test('resize handles still exist and are still anchored', async ({ page }) => {
    const handle = page.locator('#box [data-detent-handle="se"]');
    await expect(handle).toHaveCount(1);
    await expect(handle).toHaveCSS('position', 'absolute');
    await expect(handle).toHaveCSS('touch-action', 'none');
  });

  test('library-created resize handles have no size without the stylesheet', async ({ page }) => {
    // The documented limitation. Handle size and placement are cosmetic and
    // live in the stylesheet, so with no stylesheet there is nothing to grab.
    // Load detent/styles.css, or supply your own handle elements and size
    // them yourself. Asserted so the limitation cannot change unnoticed.
    const size = await page
      .locator('#box [data-detent-handle="se"]')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(size).toBe(0);
  });
});
