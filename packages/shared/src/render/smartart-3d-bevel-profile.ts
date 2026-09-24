/**
 * `a:bevelT/@prst` cross-sections for the lit SmartArt 3D solids
 * (framework-agnostic, pure).
 *
 * A profile is a polyline from the shape's outline (`s = 0`, `t = 0`) to the
 * inner edge of the bevel (`s = 1`, `t = 1`): `s` is the inset as a fraction
 * of the bevel width, `t` the height as a fraction of the bevel height. The
 * shapes follow the ECMA-376 20.1.10.9 preset silhouettes, tuned against the
 * PowerPoint exports of the SmartArt bevel quick styles
 * (`e2e/fixtures/three-d-parity/gt`): `circle` (Polished) is a quarter round,
 * `relaxedInset` (Inset) dips into a groove before rising to the face, which
 * is what paints its dark outer line and bright inner ridge.
 *
 * @module render/smartart-3d-bevel-profile
 */

/** One sample of a bevel cross-section. */
export interface BevelProfilePoint {
	/** Inset from the outline, as a fraction of the bevel width (0..1). */
	s: number;
	/** Height above the bevel's base, as a fraction of the bevel height. */
	t: number;
}

/** Samples used for the curved profiles. */
const CURVE_SEGMENTS = 8;

function sampleCurve(fn: (u: number) => BevelProfilePoint): BevelProfilePoint[] {
	const points: BevelProfilePoint[] = [];
	for (let i = 0; i <= CURVE_SEGMENTS; i++) {
		points.push(fn(i / CURVE_SEGMENTS));
	}
	return points;
}

const QUARTER = Math.PI / 2;

const PROFILES: Record<string, () => BevelProfilePoint[]> = {
	// Quarter round: vertical at the outline, flat where it meets the face.
	circle: () => sampleCurve((u) => ({ s: 1 - Math.cos(u * QUARTER), t: Math.sin(u * QUARTER) })),
	// Round, but reaching the outline at a slant instead of vertically.
	convex: () => sampleCurve((u) => ({ s: u, t: Math.sin(u * QUARTER) })),
	softRound: () => sampleCurve((u) => ({ s: u, t: 1 - (1 - u) * (1 - u) })),
	// A groove next to the outline, then a rounded rise onto the face.
	relaxedInset: () =>
		sampleCurve((u) => ({
			s: u,
			t: u * u * (3 - 2 * u) - 0.3 * Math.sin(Math.PI * u) * (1 - u),
		})),
	divot: () =>
		sampleCurve((u) => ({
			s: u,
			t: u - 0.5 * Math.sin(Math.PI * u),
		})),
	angle: () => [
		{ s: 0, t: 0 },
		{ s: 1, t: 1 },
	],
	slope: () => [
		{ s: 0, t: 0 },
		{ s: 1, t: 1 },
	],
	coolSlant: () => [
		{ s: 0, t: 0 },
		{ s: 0.3, t: 0.75 },
		{ s: 1, t: 1 },
	],
	hardEdge: () => [
		{ s: 0, t: 0 },
		{ s: 0.2, t: 0.9 },
		{ s: 1, t: 1 },
	],
	cross: () => [
		{ s: 0, t: 0 },
		{ s: 0.5, t: 1 },
		{ s: 1, t: 1 },
	],
	riblet: () => [
		{ s: 0, t: 0 },
		{ s: 0.33, t: 1 },
		{ s: 0.66, t: 0.5 },
		{ s: 1, t: 1 },
	],
	artDeco: () => [
		{ s: 0, t: 0 },
		{ s: 0.25, t: 0.5 },
		{ s: 0.5, t: 0.5 },
		{ s: 0.75, t: 1 },
		{ s: 1, t: 1 },
	],
};

/**
 * The cross-section for a bevel preset token; unknown tokens fall back to
 * `circle` (the ECMA-376 default for an `a:bevelT` without `@prst`).
 */
export function getSmartArtBevelProfile(profile: string | undefined): BevelProfilePoint[] {
	const build = (profile && PROFILES[profile]) || PROFILES.circle;
	return build();
}
