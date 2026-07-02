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

/* ------------------------------------------------------------------ *
 * Spring physics
 *
 * A real damped-harmonic-oscillator integrator, replacing the old
 * `spring` cubic-bezier fake. Semi-implicit (symplectic) Euler: velocity is
 * updated from the current force first, then position is advanced with the
 * *new* velocity. It's one extra order of accuracy over explicit Euler at
 * the same cost (still O(1) multiply-adds per step) and, critically, it's
 * numerically stable for stiff springs at animation-frame timesteps, where
 * explicit Euler can visibly diverge/blow up.
 * ------------------------------------------------------------------ */

export interface SpringParams {
  /** Restoring force per unit displacement. Higher = snappier. */
  stiffness: number;
  /** Velocity-proportional drag. Higher = less bouncy. */
  damping: number;
  /** Inertia. Higher = slower to respond. */
  mass: number;
  /**
   * Kinetic + potential energy below which the spring is considered at rest
   * and `animateSprings` stops looping. Tune down for a longer, more
   * visible settle tail; up to cut the animation off sooner.
   */
  settleThreshold: number;
}

/** A lively, general-purpose default — one gentle overshoot, settles fast. */
export const DEFAULT_SPRING_PARAMS: SpringParams = {
  stiffness: 210,
  damping: 20,
  mass: 1,
  settleThreshold: 0.0025,
};

/**
 * One damped-harmonic-oscillator channel (a single scalar: an x, a y, a
 * scale...). Multi-dimensional motion is just several of these stepped
 * together in one rAF loop (see `animateSprings`) — cheaper and simpler than
 * a vector spring, and it naturally gives independent-axis motion its own
 * organic, slightly-uncorrelated arrival (each axis settles on its own
 * schedule, proportional to how far it travelled).
 *
 * Perf note (extreme-performance mod): mutates its own fields in `step()`
 * instead of returning a new object — this runs up to once per rAF tick per
 * animated channel, so a fresh allocation every frame would be pure waste.
 */
export class Spring {
  position = 0;
  velocity = 0;
  target = 0;
  private params: SpringParams;

  constructor(params: Partial<SpringParams> = {}) {
    this.params = { ...DEFAULT_SPRING_PARAMS, ...params };
  }

  /** Jump to a fresh start/target pair (e.g. reusing a Spring instance). */
  reset(position: number, target: number, velocity = 0): void {
    this.position = position;
    this.target = target;
    this.velocity = velocity;
  }

  /** Advance by `dtMs`. Returns the new position (also on `.position`). */
  step(dtMs: number): number {
    // Clamp dt: a backgrounded tab / dropped frame can hand us a huge dt,
    // which would fling an under-damped spring miles past its target in one
    // step. 48ms ≈ 2 frames at 60fps is enough slack for normal jitter.
    const dt = Math.min(dtMs, 48) / 1000;
    const { stiffness, damping, mass } = this.params;
    const displacement = this.position - this.target;
    const accel = (-stiffness * displacement - damping * this.velocity) / mass;
    this.velocity += accel * dt;
    this.position += this.velocity * dt;
    return this.position;
  }

  /** Kinetic + potential energy relative to the target. */
  get energy(): number {
    const displacement = this.position - this.target;
    return 0.5 * this.params.mass * this.velocity * this.velocity +
      0.5 * this.params.stiffness * displacement * displacement;
  }

  /** True once kinetic + potential energy drops below `settleThreshold`. */
  get settled(): boolean {
    return this.energy < this.params.settleThreshold;
  }
}

export interface SpringDriveOptions {
  /** Safety cap in case params never settle (e.g. near-zero damping). */
  maxDuration?: number;
  signal?: AbortSignal;
}

const DEFAULT_MAX_SPRING_DURATION = 4000;

/**
 * Step N springs together in a single rAF loop until all are settled (or
 * `maxDuration` elapses). `onFrame` is called every tick with no arguments —
 * read live values off `springs[i].position` (avoids allocating a fresh
 * array/object per frame just to hand positions to the caller).
 *
 * This is the shared engine behind both `animateSpring` (below) and the
 * camera's spring-zoom path (`camera.ts`) and the cursor's arrival settle
 * (`cursor.ts`) — one rAF loop driving 1, 2 or 3 channels instead of one
 * loop per channel.
 */
export function animateSprings(
  springs: readonly Spring[],
  onFrame: () => void,
  opts: SpringDriveOptions = {},
): Promise<void> {
  const maxDuration = opts.maxDuration ?? DEFAULT_MAX_SPRING_DURATION;
  const { signal } = opts;
  return new Promise((resolve, reject) => {
    if (springs.length === 0) {
      onFrame();
      return resolve();
    }
    const start = performance.now();
    let last = start;
    let raf = 0;
    const tick = (now: number) => {
      if (signal?.aborted) {
        cancelAnimationFrame(raf);
        return reject(abortError());
      }
      const dt = now - last;
      last = now;
      let allSettled = true;
      for (let i = 0; i < springs.length; i++) {
        springs[i].step(dt);
        if (!springs[i].settled) allSettled = false;
      }
      onFrame();
      if (allSettled || now - start >= maxDuration) {
        for (const s of springs) s.position = s.target;
        onFrame();
        return resolve();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

export interface SpringAnimateOptions extends SpringDriveOptions {
  from: number;
  to: number;
  params?: Partial<SpringParams>;
}

/**
 * Single-channel convenience wrapper over `animateSprings`: animate one
 * number from `from` to `to` under spring physics, variable duration (ends
 * when the spring settles, not on a clock). This is the spring counterpart
 * to `animate()` above — same "rAF loop that resolves on completion" shape,
 * but duration emerges from the physics instead of being fixed up front.
 */
export function animateSpring(
  onFrame: (value: number, velocity: number) => void,
  opts: SpringAnimateOptions,
): Promise<void> {
  const spring = new Spring(opts.params);
  spring.reset(opts.from, opts.to);
  return animateSprings([spring], () => onFrame(spring.position, spring.velocity), opts);
}
