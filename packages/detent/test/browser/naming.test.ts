/**
 * The names the library writes into the DOM have to be legal there.
 *
 * A rename once rewrote PREFIX from 'detent' to the npm package name, and the
 * published build emitted `data-@arshad-shah/detent-live-region` — neither `@`
 * nor `/` is valid in an attribute name, so `sortable()` threw on bind and the
 * list silently never became sortable. Every existing test compared these
 * names against each other, so they all still agreed and all still passed.
 *
 * These assert the names are valid in themselves, against the DOM rather than
 * against a regex, so they hold for whatever the platform actually accepts.
 */
import { describe, expect, it } from 'vitest';
import { ATTR, CLASS, PREFIX, handleClass } from '../../src/core/constants';
import { ALL_HANDLES } from '../../src/core/resize-math';

const el = () => document.createElement('div');

describe('attribute names', () => {
  for (const [key, name] of Object.entries(ATTR)) {
    it(`ATTR.${key} (${name}) is a usable attribute name`, () => {
      expect(() => el().setAttribute(name, '')).not.toThrow();
    });

    it(`ATTR.${key} survives a round trip through a selector`, () => {
      const node = el();
      node.setAttribute(name, 'x');
      document.body.appendChild(node);
      expect(() => document.querySelector(`[${name}]`)).not.toThrow();
      expect(document.querySelector(`[${name}]`)).toBe(node);
      node.remove();
    });
  }
});

describe('class names', () => {
  const every = [...Object.values(CLASS), ...ALL_HANDLES.map(handleClass)];

  for (const name of every) {
    it(`${name} is a usable class name`, () => {
      // classList rejects whitespace and the empty string, which is what a
      // broken prefix most often produces.
      expect(() => el().classList.add(name)).not.toThrow();
    });
  }

  it('every class name is a valid CSS identifier', () => {
    for (const name of every) {
      expect(() => document.querySelector(`.${name}`)).not.toThrow();
    }
  });
});

describe('the prefix itself', () => {
  it('is a bare token, not a package name', () => {
    // The npm package is scoped; the DOM prefix must not be. These are two
    // different names that happen to share a word.
    expect(PREFIX).toBe('detent');
  });

  it('contains nothing illegal in a class or attribute name', () => {
    expect(PREFIX).toMatch(/^[a-z][a-z0-9-]*$/);
  });
});
