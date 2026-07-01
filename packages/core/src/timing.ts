/** Abort-aware delay. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ms <= 0) return resolve();
    if (signal?.aborted) return reject(abortError());
    const id = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const cleanup = () => {
      clearTimeout(id);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort);
  });
}

/**
 * Run a requestAnimationFrame loop for `duration` ms, calling `onFrame(eased)`
 * with the eased progress (0→1). Resolves when complete; rejects on abort.
 */
export function animate(
  duration: number,
  ease: (t: number) => number,
  onFrame: (value: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (duration <= 0) {
      onFrame(1);
      return resolve();
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (signal?.aborted) {
        cancelAnimationFrame(raf);
        return reject(abortError());
      }
      const t = Math.min(1, (now - start) / duration);
      onFrame(ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else resolve();
    };
    raf = requestAnimationFrame(tick);
  });
}

function abortError(): DOMException {
  return new DOMException("Telekinesis playback aborted", "AbortError");
}
