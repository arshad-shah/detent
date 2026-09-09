import { draggable, resizable, sortable, type Bounds, type HandleName } from '@arshad-shah/detent';
import { DetentElement } from './base';

const AXES = ['x', 'y', 'both'] as const;
const DIRECTIONS = ['auto', 'x', 'y', 'grid'] as const;
const HANDLES: readonly HandleName[] = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];

/** Only the keyword forms of `bounds` can be expressed as an attribute. */
function boundsOf(raw: string | undefined): Bounds | undefined {
  return raw === 'parent' || raw === 'window' ? raw : undefined;
}

/** `<detent-draggable>` — drags itself. */
export class DetentDraggable extends DetentElement {
  static observedAttributes = [
    'axis', 'bounds', 'grid', 'handle', 'cancel', 'distance', 'disabled',
  ];

  protected bind() {
    return draggable(this, {
      axis: this.oneOf('axis', AXES),
      bounds: boundsOf(this.str('bounds')),
      grid: this.num('grid'),
      handle: this.str('handle'),
      cancel: this.str('cancel'),
      distance: this.num('distance'),
      disabled: this.bool('disabled'),
      onStart: (event) => this.emit('detent:dragstart', event),
      onMove: (event) => this.emit('detent:drag', event),
      onEnd: (event, cancelled) => this.emit('detent:dragend', { ...event, cancelled }),
    });
  }
}

/** `<detent-sortable>` — reorders its own children. */
export class DetentSortable extends DetentElement {
  static observedAttributes = [
    'group', 'items', 'direction', 'animation', 'keyboard',
    'distance', 'disabled', 'z-index',
  ];

  protected bind() {
    return sortable(this, {
      group: this.str('group'),
      items: this.str('items'),
      direction: this.oneOf('direction', DIRECTIONS),
      animation: this.num('animation'),
      keyboard: this.bool('keyboard'),
      distance: this.num('distance'),
      disabled: this.bool('disabled'),
      zIndex: this.num('z-index'),
      onSort: (event) => this.emit('detent:sort', event),
      onEnd: (item, cancelled) => this.emit('detent:sortend', { item, cancelled }),
    });
  }
}

/** `<detent-resizable>` — resizes itself. */
export class DetentResizable extends DetentElement {
  static observedAttributes = [
    'handles', 'min-width', 'min-height', 'max-width', 'max-height',
    'aspect-ratio', 'grid', 'distance', 'disabled',
  ];

  protected bind() {
    const named = this.str('handles')
      ?.split(/[\s,]+/)
      .filter((name): name is HandleName => (HANDLES as readonly string[]).includes(name));

    return resizable(this, {
      handles: named?.length ? named : undefined,
      minWidth: this.num('min-width'),
      minHeight: this.num('min-height'),
      maxWidth: this.num('max-width'),
      maxHeight: this.num('max-height'),
      aspectRatio: this.num('aspect-ratio') ?? this.bool('aspect-ratio'),
      grid: this.num('grid'),
      distance: this.num('distance'),
      disabled: this.bool('disabled'),
      onStart: (event) => this.emit('detent:resizestart', event),
      onResize: (event) => this.emit('detent:resize', event),
      onEnd: (event, cancelled) => this.emit('detent:resizeend', { ...event, cancelled }),
    });
  }
}
