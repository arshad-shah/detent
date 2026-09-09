import type { Handle } from '@arshad-shah/detent';

/**
 * Shared lifecycle for the custom elements.
 *
 * Attributes are the only configuration surface, so everything arrives as a
 * string and has to be coerced. An unparseable value is left undefined rather
 * than guessed at, so the core's own default applies.
 */
export abstract class DetentElement extends HTMLElement {
  protected handle: Handle | null = null;

  /** Bind the core to this element. Called on connect and on any attribute change. */
  protected abstract bind(): Handle;

  connectedCallback(): void {
    this.rebind();
  }

  disconnectedCallback(): void {
    this.handle?.destroy();
    this.handle = null;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.rebind();
  }

  private rebind(): void {
    this.handle?.destroy();
    this.handle = this.bind();
  }

  /** A number attribute, or undefined when absent or unparseable. */
  protected num(name: string): number | undefined {
    const raw = this.getAttribute(name);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  /**
   * A boolean attribute.
   *
   * Present-but-empty means true, the HTML way. `="false"` means false, which
   * is not the HTML way but is what everyone writes when a default is true.
   */
  protected bool(name: string): boolean | undefined {
    if (!this.hasAttribute(name)) return undefined;
    const raw = this.getAttribute(name);
    return raw === '' || raw === 'true' ? true : raw === 'false' ? false : undefined;
  }

  /** A string attribute, or undefined when absent. */
  protected str(name: string): string | undefined {
    return this.getAttribute(name) ?? undefined;
  }

  /** A one-of attribute, or undefined when absent or not in the list. */
  protected oneOf<T extends string>(name: string, allowed: readonly T[]): T | undefined {
    const raw = this.getAttribute(name);
    return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
  }

  /** Emit a CustomEvent that escapes a shadow root. */
  protected emit(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
}
