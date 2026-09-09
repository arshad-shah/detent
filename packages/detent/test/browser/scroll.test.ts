import { beforeEach, describe, expect, it } from 'vitest';
import { scrollAncestorsOf, scrollParentOf, totalScroll } from '../../src/core/scroll';

function nest(styles: string[]): HTMLElement {
  let parent: HTMLElement = document.body;
  for (const css of styles) {
    const el = document.createElement('div');
    el.style.cssText = css;
    parent.appendChild(el);
    parent = el;
  }
  const target = document.createElement('div');
  target.style.cssText = 'width:50px;height:50px';
  parent.appendChild(target);
  return target;
}

describe('scroll ancestors', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds nothing when no ancestor scrolls', () => {
    const target = nest(['width:200px;height:200px']);
    expect(scrollAncestorsOf(target)).toEqual([]);
    expect(scrollParentOf(target)).toBeNull();
  });

  it('finds a scrolling ancestor, nearest first', () => {
    const target = nest([
      'overflow:auto;width:300px;height:300px',
      'width:200px;height:200px',
      'overflow:scroll;width:100px;height:100px',
    ]);
    const found = scrollAncestorsOf(target);
    expect(found).toHaveLength(2);
    expect(getComputedStyle(found[0]).overflowY).toBe('scroll');
    expect(scrollParentOf(target)).toBe(found[0]);
  });

  it('ignores hidden overflow, which does not scroll', () => {
    const target = nest(['overflow:hidden;width:200px;height:200px']);
    expect(scrollAncestorsOf(target)).toEqual([]);
  });

  it('adds up how far every ancestor has scrolled', () => {
    const target = nest([
      'overflow:auto;width:100px;height:100px',
      'width:400px;height:400px',
    ]);
    const scroller = scrollAncestorsOf(target)[0] as HTMLElement;
    scroller.scrollTop = 40;
    scroller.scrollLeft = 15;
    const total = totalScroll([scroller]);
    expect(total.y).toBe(40 + window.scrollY);
    expect(total.x).toBe(15 + window.scrollX);
  });
});
