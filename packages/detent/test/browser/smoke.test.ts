import { describe, expect, it, beforeEach } from 'vitest';

describe('browser tier', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has a real layout engine', () => {
    const el = document.createElement('div');
    el.style.cssText = 'width:120px;height:40px;position:absolute;left:10px;top:20px';
    document.body.appendChild(el);

    const rect = el.getBoundingClientRect();
    expect(rect.width).toBe(120);
    expect(rect.height).toBe(40);
    expect(rect.left).toBe(10);
    expect(rect.top).toBe(20);
  });

  it('resolves computed styles from a stylesheet', () => {
    const style = document.createElement('style');
    style.textContent = '.probe { position: absolute }';
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.className = 'probe';
    document.body.appendChild(el);

    expect(getComputedStyle(el).position).toBe('absolute');
    style.remove();
  });

  it('supports the Web Animations API', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const animation = el.animate([{ opacity: 0 }, { opacity: 1 }], 50);
    expect(typeof animation.cancel).toBe('function');
  });
});
