/**
 * SVG pattern generation for OOXML pattern fill presets.
 *
 * Thin re-export shim. The implementation now lives in the framework-agnostic
 * `pptx-viewer-shared` package (`render/fill-style.ts`), vendored into this
 * library via `../internal/shared`. This file preserves the historical
 * `./color-patterns` import surface.
 *
 * Deliberate divergence: shared `getPatternSvg` returns `string | null` for an
 * unknown preset, whereas the Angular binding's public contract (and its
 * colocated tests) expect `string | undefined`. This shim normalises `null` to
 * `undefined` so that contract is preserved.
 *
 * Reference: ECMA-376 Part 1, §20.1.10.33 (ST_PresetPatternVal).
 */
import { getPatternSvg as getPatternSvgShared } from '../internal/shared';

export { buildPatternFillCss } from '../internal/shared';

/**
 * Generate an inline SVG string for an OOXML preset pattern fill.
 *
 * @param preset  - DrawingML `ST_PresetPatternVal` string (e.g. `"pct5"`).
 * @param fgColor - Foreground hex colour (e.g. `"#000000"`).
 * @param bgColor - Background hex colour (e.g. `"#ffffff"`).
 * @returns An SVG string, or `undefined` when the preset is not implemented.
 */
export function getPatternSvg(
	preset: string,
	fgColor: string,
	bgColor: string,
): string | undefined {
	return getPatternSvgShared(preset, fgColor, bgColor) ?? undefined;
}
