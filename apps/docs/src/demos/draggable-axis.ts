import { draggable } from 'detent';

export default function mount(stage: HTMLElement): () => void {
  const handles = Array.from(stage.querySelectorAll<HTMLElement>('.demo-box')).map((box) =>
    draggable(box, { axis: box.dataset.axis === 'y' ? 'y' : 'x', bounds: 'parent' }),
  );
  return () => handles.forEach((handle) => handle.destroy());
}
