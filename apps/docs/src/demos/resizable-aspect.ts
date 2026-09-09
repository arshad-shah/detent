import { resizable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const panel = stage.querySelector<HTMLElement>('.demo-panel');
  if (!panel) return () => {};
  const handle = resizable(panel, { aspectRatio: 16 / 9, handles: ['se'], minWidth: 80 });
  return () => handle.destroy();
}
