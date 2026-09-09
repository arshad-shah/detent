import { sortable } from '@arshad-shah/detent';

export default function mount(stage: HTMLElement): () => void {
  const handles = Array.from(stage.querySelectorAll<HTMLElement>('.demo-list')).map((list) =>
    sortable(list, { group: 'docs-demo', animation: 180 }),
  );
  return () => handles.forEach((handle) => handle.destroy());
}
