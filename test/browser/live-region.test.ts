import { beforeEach, describe, expect, it } from 'vitest';
import {
  acquireLiveRegion,
  announce,
  releaseLiveRegion,
} from '../../src/sortable/live-region';
import { ATTR } from '../../src/core/constants';

const find = () => document.querySelector(`[${ATTR.liveRegion}]`);

describe('live region', () => {
  beforeEach(() => {
    while (find()) releaseLiveRegion();
    document.body.innerHTML = '';
  });

  it('is not created until a list needs it', () => {
    expect(find()).toBeNull();
  });

  it('is created on acquire and announces to assistive tech', () => {
    acquireLiveRegion();
    const region = find();
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('assertive');
    announce('Lifted from position 1 of 3.');
    expect(region!.textContent).toBe('Lifted from position 1 of 3.');
    releaseLiveRegion();
  });

  it('is hidden by inline styles a host reset cannot undo', () => {
    acquireLiveRegion();
    const region = find() as HTMLElement;
    expect(region.style.position).toBe('fixed');
    expect(region.style.width).toBe('1px');
    expect(region.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    releaseLiveRegion();
  });

  it('survives until the last list releases it', () => {
    acquireLiveRegion();
    acquireLiveRegion();
    releaseLiveRegion();
    expect(find()).not.toBeNull();
    releaseLiveRegion();
    expect(find()).toBeNull();
  });

  it('does not use a global id, which a host page could collide with', () => {
    acquireLiveRegion();
    expect(find()!.id).toBe('');
    releaseLiveRegion();
  });
});
