import { resizable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const panel = stage.querySelector<HTMLElement>('.demo-panel');
  if (!panel) return () => {};
  const handle = resizable(panel, { minWidth: 80, minHeight: 60 });
  return () => handle.destroy();
}
