/**
 * Every DOM write in the library goes through here.
 *
 * Pointer events can fire more often than the screen redraws, so applying a
 * change per event does work the user never sees. Queuing instead means each
 * job runs at most once per frame, and a job queued twice before the frame
 * lands only runs once.
 */

type Job = () => void;

const queue = new Set<Job>();
let frame = 0;

const raf: (cb: FrameRequestCallback) => number =
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb) => setTimeout(() => cb(Date.now()), 16) as unknown as number;

const cancelRaf: (id: number) => void =
  typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame
    : (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

/** Queue a DOM write for the next frame. Re-queuing the same job is a no-op. */
export function write(job: Job): void {
  queue.add(job);
  if (!frame) frame = raf(flush);
}

/** Drop a queued job, e.g. when a drag ends before its frame lands. */
export function unschedule(job: Job): void {
  queue.delete(job);
}

/** Run everything queued right now. Called by the frame, and by tests. */
export function flush(): void {
  if (frame) {
    cancelRaf(frame);
    frame = 0;
  }
  if (!queue.size) return;
  const jobs = [...queue];
  queue.clear();
  for (const job of jobs) job();
}

/**
 * How many jobs are waiting for the next frame.
 *
 * Exists so tests can assert that batching actually batches. Not part of the
 * public API.
 */
export function queued(): number {
  return queue.size;
}
