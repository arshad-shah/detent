import { beforeEach, describe, expect, it } from 'vitest';
import { resizable } from '../../src/resizable/index';
import { ATTR, CLASS } from '../../src/core/constants';

describe('resizable lifecycle', () => {
  let el: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-test]').forEach((s) => s.remove());
    el = document.createElement('div');
    el.style.cssText = 'width:200px;height:150px';
    document.body.appendChild(el);
  });

  it('leaves a host page’s inline position alone when using supplied handles', () => {
    el.style.position = 'sticky';
    const grip = document.createElement('span');
    el.appendChild(grip);

    const handle = resizable(el, { handles: { se: grip } });
    handle.destroy();

    expect(el.style.position).toBe('sticky');
  });

  it('restores the position it found when it created handles', () => {
    el.style.position = 'sticky';
    const handle = resizable(el, { handles: ['se'] });
    handle.destroy();
    expect(el.style.position).toBe('sticky');
  });

  it('gives a static element a position, then takes it away again', () => {
    const handle = resizable(el, { handles: ['se'] });
    expect(getComputedStyle(el).position).toBe('relative');
    handle.destroy();
    expect(el.style.position).toBe('');
  });

  it('anchors load-bearing handle styles inline, beyond a host reset', () => {
    const reset = document.createElement('style');
    reset.dataset.test = '';
    reset.textContent = '* { position: static; touch-action: auto }';
    document.head.appendChild(reset);

    resizable(el, { handles: ['se'] });
    const grip = el.querySelector(`[${ATTR.handle}="se"]`) as HTMLElement;

    expect(getComputedStyle(grip).position).toBe('absolute');
    expect(getComputedStyle(grip).touchAction).toBe('none');
    reset.remove();
  });

  it('removes only the handles it created', () => {
    const mine = document.createElement('span');
    el.appendChild(mine);
    const handle = resizable(el, { handles: { se: mine } });
    handle.destroy();

    expect(el.contains(mine)).toBe(true);
    expect(mine.hasAttribute(ATTR.handle)).toBe(false);
    expect(el.classList.contains(CLASS.resizable)).toBe(false);
  });
});
