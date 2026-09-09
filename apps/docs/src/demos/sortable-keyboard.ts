import { sortable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const list = stage.querySelector<HTMLElement>('.demo-list');
  if (!list) return () => {};
  for (const item of Array.from(list.children)) {
    (item as HTMLElement).tabIndex = 0;
  }
  const handle = sortable(list, { animation: 180 });
  return () => handle.destroy();
}
