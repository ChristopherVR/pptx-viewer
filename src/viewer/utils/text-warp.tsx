/**
 * SVG textPath-based text warp (WordArt) rendering engine.
 *
 * Barrel re-export — implementation split into:
 *   - warp-path-generators.ts  (SVG path generators + presets)
 *   - warp-text-renderer.tsx   (React component + styling helpers)
 */
export { shouldUseSvgWarp, getWarpPath } from "./warp-path-generators";
export type { WarpedTextProps } from "./warp-text-renderer";
export { WarpedText } from "./warp-text-renderer";
