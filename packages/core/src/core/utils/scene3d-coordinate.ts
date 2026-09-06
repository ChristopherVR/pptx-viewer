/**
 * Integer-safe encoding helpers for OOXML `ST_Coordinate` triples used by
 * `a:scene3d/a:backdrop` (`a:anchor` / `a:norm` / `a:up`) in both the shape
 * (`a:sp3d`/`a:scene3d`) and text-body (`a:bodyPr/a:scene3d`) save paths.
 *
 * `ST_Coordinate` is a signed integer: EMU-scale for a real position such as
 * `a:anchor`, or an arbitrary integer for a direction such as `a:norm`/`a:up`,
 * where only the RATIO between the three components matters, not their
 * absolute magnitude. `Pptx3DScene`'s `backdrop*` fields are typed as plain
 * `number` with no compile-time guarantee they hold an integer: parsing
 * (`applyPoint`/`intAttr`, both `parseInt`-based) always produces one, but a
 * caller constructing a `ShapeStyle`/`TextStyle` directly (the public
 * `PptxHandler` API, a hand-built fixture, a future editor control) may
 * naturally reach for a normalised unit vector such as `(0.707, 0.707, 0)`,
 * which - written verbatim via `String(x)` - produces a non-integer
 * `ST_Coordinate` attribute and corrupts the file for real PowerPoint (COM
 * `Slide.Export`/open confirmed real PowerPoint rejects/repairs a decimal
 * `a:norm/@dx`).
 *
 * @module core/utils/scene3d-coordinate
 */

/** Round a single position component (`a:anchor`) to the nearest integer. */
export function roundCoordinate(value: number): number {
	return Math.round(value);
}

/** A direction vector's three components, already integer `ST_Coordinate` values. */
export interface IntegerVector3 {
	x: number;
	y: number;
	z: number;
}

/**
 * Scale factor applied to every component of a direction vector when at
 * least one of the three is fractional, before rounding to the nearest
 * integer. Large enough that a normalised unit vector's components (each in
 * roughly [-1, 1]) round-trip with negligible loss, while keeping every
 * output comfortably inside `ST_Coordinate`'s signed-integer range.
 */
const FRACTIONAL_VECTOR_SCALE = 1_000_000;

/**
 * Encode a direction vector (`a:norm`/`a:up`) as three integer
 * `ST_Coordinate` values, preserving the ratio between components.
 *
 * When every component is already an integer (the common case: values
 * round-tripped from a parsed file, where the parser only ever produces
 * integers), they pass through unchanged. When any component is fractional
 * (a normalised direction, typically each in [-1, 1]), all three are scaled
 * by the same factor before rounding, so the ratio between them survives
 * instead of a small component collapsing to 0 under independent rounding
 * (e.g. `(0.1, 0.9, 0.4)` rounded independently would become `(0, 1, 0)`,
 * silently dropping the x/z components and changing the represented
 * direction).
 */
export function scaleVectorToIntegers(x: number, y: number, z: number): IntegerVector3 {
	const allInts = Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z);
	const scale = allInts ? 1 : FRACTIONAL_VECTOR_SCALE;
	return {
		x: Math.round(x * scale),
		y: Math.round(y * scale),
		z: Math.round(z * scale),
	};
}
