import { PREFIX } from './constants';

/**
 * A precondition that only exists in development builds.
 *
 * The bundler replaces `__DEV__` with `false` for production, so the whole
 * call — including the message string — is dropped. Guards are therefore free
 * to be wordy and specific.
 *
 * This is for programming mistakes by the consumer, never for runtime
 * conditions the library should handle. If a situation is recoverable, handle
 * it; if it means the caller got the API wrong, say so here.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (__DEV__ && !condition) {
    throw new Error(`[${PREFIX}] ${message}`);
  }
}
