import { resizable, sortable } from '@arshad-shah/detent';

/** All three ideas in one stage: a sortable list beside a resizable panel. */
export default function mount(stage: HTMLElement): () => void {
  const handles: Array<{ destroy(): void }> = [];

  const list = stage.querySelector<HTMLElement>('.demo-list');
  if (list) {
    for (const item of Array.from(list.children)) {
      (item as HTMLElement).tabIndex = 0;
    }
    handles.push(sortable(list, { animation: 180 }));
  }

  const panel = stage.querySelector<HTMLElement>('.demo-panel');
  if (panel) handles.push(resizable(panel, { minWidth: 100, minHeight: 80 }));

  return () => handles.forEach((handle) => handle.destroy());
}
