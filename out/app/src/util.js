// Small shared helpers: clamping and the seeded random stream every
// deterministic feature (grain, "Surprise me", screenshot presets) relies on.

/** Restricts `value` to the closed interval [min, max]. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** mulberry32: a tiny seeded PRNG. Same seed in, same stream out — the app
 *  never touches Math.random so renders stay reproducible. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
