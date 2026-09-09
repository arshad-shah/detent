import { beforeEach, describe, expect, it } from 'vitest';
import styles from '../../src/styles.css?raw';
import { ATTR, CLASS, DEFAULTS, PREFIX, handleClass } from '../../src/core/constants';
import { ALL_HANDLES } from '../../src/core/resize-math';
import { resizable } from '../../src/resizable/index';

/** Declarations only — comments discuss !important without using it. */
const declarations = styles.replace(/\/\*[\s\S]*?\*\//g, '');

function loadStyles(): HTMLStyleElement {
  const tag = document.createElement('style');
  tag.dataset.test = '';
  tag.textContent = styles;
  document.head.appendChild(tag);
  return tag;
}

describe('stylesheet contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-test]').forEach((s) => s.remove());
  });

  it('carries no leftover dk- prefix', () => {
    expect(declarations).not.toMatch(/\bdk-/);
  });

  it('never uses !important', () => {
    expect(declarations).not.toMatch(/!\s*important/);
  });

  it('ships inside the detent cascade layer', () => {
    expect(styles).toMatch(new RegExp(`@layer\\s+${PREFIX}\\b`));
  });

  it('declares a handle size matching the TypeScript default', () => {
    const match = new RegExp(`--${PREFIX}-handle-size:\\s*(\\d+)px`).exec(styles);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(DEFAULTS.handleSize);
  });

  it('styles every handle direction the library can create', () => {
    for (const name of ALL_HANDLES) {
      expect(styles).toContain(handleClass(name));
    }
  });

  it('names every class the library applies', () => {
    for (const name of [CLASS.resizable, CLASS.handle, CLASS.dragging, CLASS.sorting]) {
      expect(styles).toContain(name);
    }
  });

  it('lets an unlayered host rule win, because it is in a layer', () => {
    loadStyles();
    const host = document.createElement('style');
    host.dataset.test = '';
    host.textContent = `.${CLASS.handle} { width: 40px }`;
    document.head.appendChild(host);

    const el = document.createElement('div');
    el.style.cssText = 'width:200px;height:150px';
    document.body.appendChild(el);
    resizable(el, { handles: ['se'] });

    const grip = el.querySelector(`[${ATTR.handle}="se"]`) as HTMLElement;
    expect(getComputedStyle(grip).width).toBe('40px');
  });
});
