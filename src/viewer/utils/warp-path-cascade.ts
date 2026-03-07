/**
 * Cascade warp path generators for WordArt text rendering.
 *
 * Lines tilt diagonally to create a cascading staircase effect.
 */

/** Cascading up - lines tilt from lower-left to upper-right. */
export function cascadeUpPath(w: number, h: number, t: number): string {
  const yStart = h * (0.3 + t * 0.6);
  const yEnd = h * (0.1 + t * 0.6);
  return `M 0,${yStart} L ${w},${yEnd}`;
}

/** Cascading down - lines tilt from upper-left to lower-right. */
export function cascadeDownPath(w: number, h: number, t: number): string {
  const yStart = h * (0.1 + t * 0.6);
  const yEnd = h * (0.3 + t * 0.6);
  return `M 0,${yStart} L ${w},${yEnd}`;
}
