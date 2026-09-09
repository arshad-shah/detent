import { beforeEach, describe, expect, it } from 'vitest';
import { scaleOf, unscale } from '../../src/core/scale';

describe('scaleOf', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function inside(css: string): HTMLElement {
    const parent = document.createElement('div');
    parent.style.cssText = css;
    const el = document.createElement('div');
    el.style.cssText = 'width:100px;height:80px';
    parent.appendChild(el);
    document.body.appendChild(parent);
    return el;
  }

  it('reports 1 when nothing is transformed', () => {
    expect(scaleOf(inside('width:400px'))).toEqual({ x: 1, y: 1 });
  });

  it('reports the scale of a transformed ancestor', () => {
    const el = inside('width:400px;transform:scale(0.5)');
    const scale = scaleOf(el);
    expect(scale.x).toBeCloseTo(0.5, 5);
    expect(scale.y).toBeCloseTo(0.5, 5);
  });

  it('reports each axis separately', () => {
    const el = inside('width:400px;transform:scale(0.5, 2)');
    expect(scaleOf(el).x).toBeCloseTo(0.5, 5);
    expect(scaleOf(el).y).toBeCloseTo(2, 5);
  });

  it('falls back to 1 for an element with no layout box', () => {
    const el = inside('display:none');
    expect(scaleOf(el)).toEqual({ x: 1, y: 1 });
  });
});

describe('unscale', () => {
  it('leaves a delta alone at scale 1', () => {
    expect(unscale({ x: 30, y: 10 }, { x: 1, y: 1 })).toEqual({ x: 30, y: 10 });
  });

  it('converts pointer travel into layout pixels', () => {
    // The pointer moved 30 rendered px inside a half-scale container, so the
    // element must move 60 layout px to stay under it.
    expect(unscale({ x: 30, y: 10 }, { x: 0.5, y: 0.5 })).toEqual({ x: 60, y: 20 });
  });
});
