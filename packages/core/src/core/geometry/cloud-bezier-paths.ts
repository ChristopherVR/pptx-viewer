/**
 * High-DPI Bezier-curve clip-paths for `cloud` and `cloudCallout` presets.
 *
 * The static polygon entries in {@link CLIP_PATHS_EXTENDED} approximate the
 * cumulus silhouette with 32 vertices, which becomes visibly faceted on
 * Retina/4K displays. These helpers return CSS `path('M…Z')` expressions
 * built from cubic-Bezier lobes, so the outline stays smooth at any DPI.
 *
 * `path()` in CSS does not accept percentage units, so callers must supply
 * pixel dimensions and re-compute on resize. Use {@link getCloudPathForRendering}
 * (in `shape-geometry.ts`) for the shape-aware wrapper.
 *
 * Browser support: Chrome 109+, Safari 15.4+, Firefox 105+.
 *
 * @module cloud-bezier-paths
 */

/**
 * Format a number for emission in a path() string.
 * Trims trailing zeros and rounds sub-pixel jitter to 2 decimals so the
 * output is deterministic for given dimensions (test expectation).
 */
function fmt(n: number): string {
	if (!Number.isFinite(n)) {
		return '0';
	}
	const rounded = Math.round(n * 100) / 100;
	// Avoid "-0"
	if (Object.is(rounded, -0)) {
		return '0';
	}
	return String(rounded);
}

/**
 * One lobe of a cumulus cloud, expressed as polar coordinates relative to
 * the body centre. `cx`/`cy` is the lobe centre, expressed as a fraction of
 * the body's semi-axes (radial fraction in `[0, 1]`). `r` is the lobe radius
 * (also a fraction of the body semi-axis). Lobes are ordered clockwise so
 * the resulting path winds correctly.
 *
 * The ECMA-376 cloud preset has 8 outer arc bumps. We arrange them so the
 * top of the cloud has 3 bumps (typical cumulus piles) and the lower
 * lobes hug the baseline.
 */
interface CloudLobe {
	/** Angle of lobe centre from the body centre (radians, 0 = +x). */
	angle: number;
	/** Lobe centre radial offset, fraction of the body semi-axis. */
	cr: number;
	/** Lobe radius, fraction of the body semi-axis. */
	r: number;
}

/**
 * 8-lobe cumulus arrangement for the `cloud` preset body.
 *
 * Angles step around the centre; the top three lobes (≈ -2π/3 .. -π/3) are
 * pulled outward and given larger radii to read as the prominent cumulus
 * piles. The bottom is a flatter pair to match the PowerPoint silhouette.
 */
const CLOUD_LOBES: readonly CloudLobe[] = [
	// Right side, slightly above the equator
	{ angle: -Math.PI * 0.15, cr: 0.85, r: 0.22 },
	// Top-right pile
	{ angle: -Math.PI * 0.4, cr: 0.78, r: 0.26 },
	// Top centre pile (tallest)
	{ angle: -Math.PI * 0.5, cr: 0.72, r: 0.3 },
	// Top-left pile
	{ angle: -Math.PI * 0.6, cr: 0.78, r: 0.26 },
	// Left side, slightly above the equator
	{ angle: -Math.PI * 0.85, cr: 0.85, r: 0.22 },
	// Bottom-left lobe (smaller, baseline)
	{ angle: Math.PI * 0.85, cr: 0.82, r: 0.2 },
	// Bottom centre flat lobe
	{ angle: Math.PI * 0.5, cr: 0.78, r: 0.22 },
	// Bottom-right lobe (smaller, baseline)
	{ angle: Math.PI * 0.15, cr: 0.82, r: 0.2 },
];

/**
 * Tail bumps for the `cloudCallout` pointer.
 *
 * The default callout pointer (per ECMA-376 spec defaults `adj1=-20833`,
 * `adj2=62500`) trails toward the lower-left of the body. We approximate
 * the trail with three decreasing bumps lying on a line from the body to
 * the pointer tip, then close back to the body.
 *
 * Coordinates are fractions of (width, height) of the *full bounding box*
 * (which is larger than the body so the tail fits).
 */
interface CloudCalloutBump {
	/** Centre x as fraction of width. */
	cx: number;
	/** Centre y as fraction of height. */
	cy: number;
	/** Radius as fraction of min(width, height). */
	r: number;
}

const CLOUD_CALLOUT_TAIL: readonly CloudCalloutBump[] = [
	// Bump nearest body
	{ cx: 0.18, cy: 0.78, r: 0.06 },
	// Middle bump
	{ cx: 0.1, cy: 0.88, r: 0.04 },
	// Smallest bump near pointer tip
	{ cx: 0.04, cy: 0.96, r: 0.025 },
];

/**
 * Magic constant for approximating a quarter-circle with a cubic-Bezier:
 * `c = 4 * (sqrt(2) - 1) / 3 ≈ 0.5522847`. Used to bend each lobe into
 * a near-circle using two cubic-Beziers per lobe.
 */
const KAPPA = 0.5522847498307936;

/**
 * Build the cubic-Bezier outline for a single circular lobe centred at
 * `(cx, cy)` with radius `r`. Returns a string starting with "M" and
 * containing 4 cubic-Bezier ("C") commands -- one for each quadrant.
 *
 * Used internally by both cloud and cloudCallout helpers. Callers should
 * dedupe the leading "M" if chaining lobes.
 */
function bezierCircle(cx: number, cy: number, r: number): string {
	const c = r * KAPPA;
	const x0 = cx + r;
	const y0 = cy;
	const parts: string[] = [];
	parts.push(`M${fmt(x0)} ${fmt(y0)}`);
	// Quadrant 1 (right -> top)
	parts.push(
		`C${fmt(cx + r)} ${fmt(cy - c)} ${fmt(cx + c)} ${fmt(cy - r)} ${fmt(cx)} ${fmt(cy - r)}`,
	);
	// Quadrant 2 (top -> left)
	parts.push(
		`C${fmt(cx - c)} ${fmt(cy - r)} ${fmt(cx - r)} ${fmt(cy - c)} ${fmt(cx - r)} ${fmt(cy)}`,
	);
	// Quadrant 3 (left -> bottom)
	parts.push(
		`C${fmt(cx - r)} ${fmt(cy + c)} ${fmt(cx - c)} ${fmt(cy + r)} ${fmt(cx)} ${fmt(cy + r)}`,
	);
	// Quadrant 4 (bottom -> right)
	parts.push(
		`C${fmt(cx + c)} ${fmt(cy + r)} ${fmt(cx + r)} ${fmt(cy + c)} ${fmt(cx + r)} ${fmt(cy)}`,
	);
	return parts.join(' ');
}

/**
 * Produce a CSS `clip-path: path('…')` expression for the `cloud` preset.
 *
 * The body centre is the bounding-box centre. 8 cubic-Bezier lobes are
 * walked clockwise; each lobe is rendered as a near-circular bump using
 * two cubic-Bezier segments connected by a transition arc back toward the
 * next lobe's start. The path is closed with `Z`.
 *
 * @param width - Element width in pixels.
 * @param height - Element height in pixels.
 * @returns A CSS `path('M…Z')` expression suitable for `clip-path`.
 */
export function getCloudClipPath(width: number, height: number): string {
	const w = Math.max(width, 1);
	const h = Math.max(height, 1);
	const cx = w / 2;
	const cy = h / 2;
	// Body semi-axes: leave a 5% margin so lobes don't clip the bounding box.
	const ax = w * 0.45;
	const ay = h * 0.45;

	const segments: string[] = [];
	let started = false;

	for (const lobe of CLOUD_LOBES) {
		const lx = cx + Math.cos(lobe.angle) * lobe.cr * ax;
		const ly = cy + Math.sin(lobe.angle) * lobe.cr * ay;
		// Use the smaller semi-axis so lobes stay round even on wide elements.
		const r = lobe.r * Math.min(ax, ay);

		const c = r * KAPPA;
		if (!started) {
			segments.push(`M${fmt(lx + r)} ${fmt(ly)}`);
			started = true;
		} else {
			// Connect from the previous lobe's exit (right side) to this lobe's
			// entry (right side) with a smooth cubic; this fuses adjacent lobes
			// rather than leaving visible gaps.
			segments.push(`L${fmt(lx + r)} ${fmt(ly)}`);
		}
		// Two cubic-Beziers tracing the outer half of this lobe (right -> top -> left -> bottom -> right)
		segments.push(
			`C${fmt(lx + r)} ${fmt(ly - c)} ${fmt(lx + c)} ${fmt(ly - r)} ${fmt(lx)} ${fmt(ly - r)}`,
		);
		segments.push(
			`C${fmt(lx - c)} ${fmt(ly - r)} ${fmt(lx - r)} ${fmt(ly - c)} ${fmt(lx - r)} ${fmt(ly)}`,
		);
		segments.push(
			`C${fmt(lx - r)} ${fmt(ly + c)} ${fmt(lx - c)} ${fmt(ly + r)} ${fmt(lx)} ${fmt(ly + r)}`,
		);
		segments.push(
			`C${fmt(lx + c)} ${fmt(ly + r)} ${fmt(lx + r)} ${fmt(ly + c)} ${fmt(lx + r)} ${fmt(ly)}`,
		);
	}

	segments.push('Z');
	return `path('${segments.join(' ')}')`;
}

/**
 * Produce a CSS `clip-path: path('…')` expression for the `cloudCallout`
 * preset. Combines the 8-lobe cumulus body with the spec-default 3-bump
 * tail trailing toward the lower-left.
 *
 * The body is shrunk to ~75% of the bounding box (centred slightly toward
 * the upper-right) so the tail bumps fit within the 100% box. Adjustment-
 * driven repositioning of the pointer tip is handled by Agent B in
 * `adjustment-aware-shapes.ts`; this helper uses the spec defaults.
 *
 * @param width - Element width in pixels.
 * @param height - Element height in pixels.
 * @returns A CSS `path('M…Z')` expression suitable for `clip-path`.
 */
export function getCloudCalloutClipPath(width: number, height: number): string {
	const w = Math.max(width, 1);
	const h = Math.max(height, 1);
	// Body occupies the upper-right 75% so the tail (~25% of width/height)
	// fits in the lower-left quadrant.
	const bodyW = w * 0.75;
	const bodyH = h * 0.75;
	const cx = w * 0.5 + bodyW * 0.05;
	const cy = h * 0.5 - bodyH * 0.05;
	const ax = bodyW * 0.45;
	const ay = bodyH * 0.45;

	const segments: string[] = [];
	let started = false;

	for (const lobe of CLOUD_LOBES) {
		const lx = cx + Math.cos(lobe.angle) * lobe.cr * ax;
		const ly = cy + Math.sin(lobe.angle) * lobe.cr * ay;
		const r = lobe.r * Math.min(ax, ay);

		const c = r * KAPPA;
		if (!started) {
			segments.push(`M${fmt(lx + r)} ${fmt(ly)}`);
			started = true;
		} else {
			segments.push(`L${fmt(lx + r)} ${fmt(ly)}`);
		}
		segments.push(
			`C${fmt(lx + r)} ${fmt(ly - c)} ${fmt(lx + c)} ${fmt(ly - r)} ${fmt(lx)} ${fmt(ly - r)}`,
		);
		segments.push(
			`C${fmt(lx - c)} ${fmt(ly - r)} ${fmt(lx - r)} ${fmt(ly - c)} ${fmt(lx - r)} ${fmt(ly)}`,
		);
		segments.push(
			`C${fmt(lx - r)} ${fmt(ly + c)} ${fmt(lx - c)} ${fmt(ly + r)} ${fmt(lx)} ${fmt(ly + r)}`,
		);
		segments.push(
			`C${fmt(lx + c)} ${fmt(ly + r)} ${fmt(lx + r)} ${fmt(ly + c)} ${fmt(lx + r)} ${fmt(ly)}`,
		);
	}

	// Body subpath closes here so the tail bumps are independent shapes
	// the renderer unions via the default `evenodd`/`nonzero` fill rule.
	segments.push('Z');

	// Tail bumps: each is a self-contained closed cubic-Bezier circle.
	const minSide = Math.min(w, h);
	for (const bump of CLOUD_CALLOUT_TAIL) {
		const bx = bump.cx * w;
		const by = bump.cy * h;
		const br = bump.r * minSide;
		segments.push(bezierCircle(bx, by, br));
		segments.push('Z');
	}

	return `path('${segments.join(' ')}')`;
}

/**
 * Lobe count exposed for tests and downstream consumers that want to
 * verify the spec-correct number of cumulus piles.
 */
export const CLOUD_LOBE_COUNT = CLOUD_LOBES.length;

/**
 * Tail bump count exposed for tests; matches the spec default for the
 * `cloudCallout` pointer trail.
 */
export const CLOUD_CALLOUT_TAIL_COUNT = CLOUD_CALLOUT_TAIL.length;
