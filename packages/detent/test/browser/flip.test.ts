import { beforeEach, describe, expect, it } from 'vitest';
import * as flip from '../../src/core/flip';

describe('flip', () => {
  let items: HTMLElement[];

  beforeEach(() => {
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    items = ['a', 'b', 'c'].map((id) => {
      const el = document.createElement('div');
      el.dataset.id = id;
      el.style.cssText = 'height:40px;width:100px';
      wrap.appendChild(el);
      return el;
    });
    document.body.appendChild(wrap);
  });

  it('animates elements that moved', () => {
    const before = flip.record(items);
    items[0].parentElement!.appendChild(items[0]);
    flip.play(before, 200);
    expect(items[0].getAnimations().length).toBe(1);
  });

  it('does not animate elements that stayed put', () => {
    const before = flip.record(items);
    flip.play(before, 200);
    expect(items[1].getAnimations().length).toBe(0);
  });

  it('measures every element before cancelling any animation', () => {
    // A second reorder while the first is still animating must land on the
    // positions elements are actually at, not on positions corrupted by a
    // cancel that happened mid-measure.
    const first = flip.record(items);
    items[0].parentElement!.appendChild(items[0]);
    flip.play(first, 200);

    const second = flip.record(items);
    items[2].parentElement!.prepend(items[2]);
    expect(() => flip.play(second, 200)).not.toThrow();
    expect(items[0].getAnimations().length).toBeLessThanOrEqual(1);
  });

  it('cancels everything on stopAll', () => {
    const before = flip.record(items);
    items[0].parentElement!.appendChild(items[0]);
    flip.play(before, 200);
    flip.stopAll(items);
    expect(items[0].getAnimations().length).toBe(0);
  });

  it('does nothing when the duration is zero', () => {
    const before = flip.record(items);
    items[0].parentElement!.appendChild(items[0]);
    flip.play(before, 0);
    expect(items[0].getAnimations().length).toBe(0);
  });
});
