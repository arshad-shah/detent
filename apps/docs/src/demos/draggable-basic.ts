import { draggable } from '@arshad-shah/detent';

/**
 * Mount the demo into `stage` and return a teardown function.
 *
 * Every demo module follows this shape so the harness can rebuild any of them
 * on Reset without knowing what they contain.
 */
export default function mount(stage: HTMLElement): () => void {
  const box = stage.querySelector<HTMLElement>('.demo-box');
  if (!box) return () => {};

  const handle = draggable(box, { bounds: 'parent' });
  return () => handle.destroy();
}
