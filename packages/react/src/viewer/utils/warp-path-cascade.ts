/**
 * Cascade warp path generators for WordArt text rendering.
 *
 * Lines tilt diagonally to create a cascading staircase effect.
 */

/** Cascading up - lines tilt from lower-left to upper-right.
 *  adj (default 44444) controls the cascade tilt amount. */
export function cascadeUpPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 44444 : 1;
  const tilt = 0.2 * Math.max(0, Math.min(adjFactor, 4));
  const yMid = h * (0.2 + t * 0.6);
  const yStart = yMid + h * tilt / 2;
  const yEnd = yMid - h * tilt / 2;
  return `M 0,${yStart} L ${w},${yEnd}`;
}

/** Cascading down - lines tilt from upper-left to lower-right.
 *  adj (default 44444) controls the cascade tilt amount. */
export function cascadeDownPath(w: number, h: number, t: number, adj?: number): string {
  const adjFactor = adj !== undefined ? adj / 44444 : 1;
  const tilt = 0.2 * Math.max(0, Math.min(adjFactor, 4));
  const yMid = h * (0.2 + t * 0.6);
  const yStart = yMid - h * tilt / 2;
  const yEnd = yMid + h * tilt / 2;
  return `M 0,${yStart} L ${w},${yEnd}`;
}
