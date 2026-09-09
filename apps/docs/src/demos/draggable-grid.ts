import { draggable } from '@arshad-shah/detent';

export default function mount(stage: HTMLElement): () => void {
  const box = stage.querySelector<HTMLElement>('.demo-box');
  if (!box) return () => {};
  const handle = draggable(box, { grid: 40, bounds: 'parent' });
  return () => handle.destroy();
}
