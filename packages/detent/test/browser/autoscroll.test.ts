import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAutoScroll } from '../../src/core/autoscroll';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

describe('auto-scroll', () => {
  let scroller: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    scroller = document.createElement('div');
    scroller.style.cssText =
      'overflow:auto;width:200px;height:200px;scroll-behavior:smooth';
    const tall = document.createElement('div');
    tall.style.cssText = 'height:2000px';
    scroller.appendChild(tall);
    document.body.appendChild(scroller);
  });

  afterEach(() => {
    document.documentElement.style.scrollBehavior = '';
  });

  it('advances monotonically even when the container scrolls smoothly', async () => {
    const auto = createAutoScroll(scroller);
    const rect = scroller.getBoundingClientRect();
    auto.update({ x: rect.left + 100, y: rect.bottom - 5 });

    const samples: number[] = [];
    for (let i = 0; i < 6; i++) {
      await nextFrame();
      samples.push(scroller.scrollTop);
    }
    auto.stop();

    expect(samples[samples.length - 1]).toBeGreaterThan(0);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });

  it('reports each step so the caller can recompute', async () => {
    let steps = 0;
    const auto = createAutoScroll(scroller, { onScroll: () => steps++ });
    const rect = scroller.getBoundingClientRect();
    auto.update({ x: rect.left + 100, y: rect.bottom - 5 });
    await nextFrame();
    await nextFrame();
    auto.stop();
    expect(steps).toBeGreaterThan(0);
  });

  it('does nothing when the pointer is nowhere near an edge', async () => {
    const auto = createAutoScroll(scroller);
    const rect = scroller.getBoundingClientRect();
    auto.update({ x: rect.left + 100, y: rect.top + 100 });
    await nextFrame();
    await nextFrame();
    auto.stop();
    expect(scroller.scrollTop).toBe(0);
  });
});
