import { sortable } from '@arshad-shah/detent';

export default function mount(stage: HTMLElement): () => void {
  const list = stage.querySelector<HTMLElement>('.demo-list');
  if (!list) return () => {};
  const handle = sortable(list, { animation: 180 });
  return () => handle.destroy();
}
