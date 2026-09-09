/**
 * happy-dom covers most of what the library touches, but not pointer events or
 * the Web Animations API. Both are shimmed here rather than in the library, so
 * production code stays free of test-only branches.
 */

if (typeof (globalThis as any).PointerEvent !== 'function') {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: any = {}) {
      super(type, { bubbles: true, cancelable: true, composed: true, ...init });
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  (globalThis as any).PointerEvent = PointerEventShim;
}

if (typeof Element.prototype.animate !== 'function') {
  Element.prototype.animate = function animate() {
    const played: any = {
      cancel() {},
      finish() {},
      finished: Promise.resolve(),
    };
    return played;
  } as any;
}

if (typeof globalThis.matchMedia !== 'function') {
  (globalThis as any).matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
}
