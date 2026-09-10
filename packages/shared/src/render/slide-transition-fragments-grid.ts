/**
 * `slide-transition-fragments-grid` - grid-based fragment builders for
 * `vortex` (dense particle dissolve + directional sweep), `honeycomb`
 * (hexagonal tile reveal) and `glitter` (diamond sparkle dissolve).
 *
 * See `slide-transition-fragments.ts` for the COM measurement these are
 * built from, and `slide-transition-fragment-types.ts` for the descriptor
 * shape. Pure; no framework or DOM imports.
 *
 * @module render/slide-transition-fragments-grid
 */

import type { FragmentedLayer, TransitionFragment } from './slide-transition-fragment-types';
import { deg, pct, round, seededUnit } from './slide-transition-fragment-types';

/** `clip-path` for an axis-aligned rectangle, in slide-percent coordinates. */
function rectClipPath(left: number, top: number, width: number, height: number, inset = 0): string {
	const l = left + inset;
	const t = top + inset;
	const r = left + width - inset;
	const b = top + height - inset;
	return `polygon(${pct(l)} ${pct(t)}, ${pct(r)} ${pct(t)}, ${pct(r)} ${pct(b)}, ${pct(l)} ${pct(b)})`;
}

/** `clip-path` for a diamond inscribed in a cell's bounding box. */
function diamondClipPath(left: number, top: number, width: number, height: number): string {
	const cx = left + width / 2;
	const cy = top + height / 2;
	return `polygon(${pct(cx)} ${pct(top)}, ${pct(left + width)} ${pct(cy)}, ${pct(cx)} ${pct(top + height)}, ${pct(left)} ${pct(cy)})`;
}

/**
 * Vortex: measured via COM `CreateVideo` as a dense full-frame dissolve of
 * small rectangular particles (both the outgoing content's own colouring and
 * the backdrop mixed together), which then clears in a directional sweep
 * (left-to-right for `dir="l"`) rather than a literal rotating spiral.
 * Capped at 12x7 = 84 particles: dense enough to read as "dust", far under a
 * budget a compositor struggles with.
 */
const VORTEX_COLS_DEFAULT = 12;
const VORTEX_COLS_MIN = 8;
const VORTEX_COLS_MAX = 16;
const VORTEX_ROWS = 7;

/**
 * Real `p14:vortex` carries no `spokes` attribute (unlike `p:wheel`), so this
 * is an opt-in density knob rather than an OOXML-faithful mapping: an authored
 * `spokes` value (1-8, the same range `p:wheel` offers) nudges the dissolve
 * grid's column count, capped to a range that keeps the fragment count in a
 * GPU-friendly budget. Absent `spokes`, the default (measured-appropriate)
 * density is used.
 */
function resolveVortexCols(spokes: number | undefined): number {
	if (spokes === undefined || !Number.isFinite(spokes) || spokes <= 0) {
		return VORTEX_COLS_DEFAULT;
	}
	return Math.min(
		VORTEX_COLS_MAX,
		Math.max(VORTEX_COLS_MIN, VORTEX_COLS_DEFAULT + Math.round(spokes)),
	);
}

export function vortexFragments(
	durationMs: number,
	direction: string | undefined,
	spokes: number | undefined,
): FragmentedLayer {
	const reverse = direction === 'r';
	const cols = resolveVortexCols(spokes);
	const fragments: TransitionFragment[] = [];
	for (let row = 0; row < VORTEX_ROWS; row++) {
		for (let col = 0; col < cols; col++) {
			const width = 100 / cols;
			const height = 100 / VORTEX_ROWS;
			const left = col * width;
			const top = row * height;
			// Sweep progresses across columns (or reversed for a right-origin
			// sweep); a per-particle jitter keeps the dissolve from reading as a
			// mechanical, perfectly-diagonal wipe.
			const colFrac = reverse ? 1 - col / (cols - 1) : col / (cols - 1);
			const jitter = seededUnit(row * 31 + col * 7);
			const delayMs = round(colFrac * durationMs * 0.55 + jitter * durationMs * 0.2);
			const dx = round((seededUnit(row * 17 + col * 3) - 0.5) * 30);
			const dy = round((seededUnit(row * 5 + col * 41) - 0.5) * 30);
			fragments.push({
				id: `vortex-${row}-${col}`,
				clipPath: rectClipPath(left, top, width, height, Math.min(width, height) * 0.12),
				vars: {
					'--frag-dx': pct(dx),
					'--frag-dy': pct(dy),
					'--frag-scale-end': String(round(0.25 + jitter * 0.35)),
				},
				delayMs,
				transformOrigin: '50% 50%',
			});
		}
	}
	return {
		keyframesName: 'pptx-tr-frag-vortex',
		durationMs: Math.round(durationMs * 0.65),
		easing: 'ease-out',
		fragments,
	};
}

/**
 * Honeycomb: measured as hexagonal tiles populating the incoming slide in a
 * scattered, diagonally-converging order rather than a uniform fade. Capped
 * at a 7x5 flat-top hex grid (35 tiles).
 */
const HONEYCOMB_COLS = 7;
const HONEYCOMB_ROWS = 5;

function hexPolygon(cx: number, cy: number, s: number): string {
	const points = [0, 60, 120, 180, 240, 300].map((angleDeg) => {
		const rad = (Math.PI / 180) * angleDeg;
		const x = cx + s * Math.cos(rad);
		// Squashed vertically: the clip-path percentages are relative to the
		// slide's own (16:9) box, so a geometrically regular hexagon in that
		// percent space reads visually regular on screen.
		const y = cy + s * Math.sin(rad) * 0.62;
		return `${round(x)}% ${round(y)}%`;
	});
	return `polygon(${points.join(', ')})`;
}

export function honeycombFragments(durationMs: number): FragmentedLayer {
	const s = 100 / (1.5 * HONEYCOMB_COLS + 0.5);
	const hexHeight = s / 0.62;
	const fragments: TransitionFragment[] = [];
	for (let col = 0; col < HONEYCOMB_COLS; col++) {
		const cx = s + col * 1.5 * s;
		const colOffset = (col % 2) * (hexHeight / 2);
		for (let row = 0; row < HONEYCOMB_ROWS; row++) {
			const cy = hexHeight / 2 + row * hexHeight + colOffset;
			if (cy - hexHeight / 2 > 102) {
				continue;
			}
			// Diagonal populate order, matching the measured fill pattern.
			const wave = col * 0.6 + row * 0.5;
			const jitter = seededUnit(col * 13 + row * 29) * 0.4;
			const delayMs = round(
				(wave / (HONEYCOMB_COLS * 0.6 + HONEYCOMB_ROWS * 0.5) + jitter) * durationMs * 0.6,
			);
			fragments.push({
				id: `honeycomb-${col}-${row}`,
				clipPath: hexPolygon(cx, cy, s * 0.94),
				vars: { '--frag-scale-start': '0.15' },
				delayMs,
				transformOrigin: `${round(cx)}% ${round(cy)}%`,
			});
		}
	}
	return {
		keyframesName: 'pptx-tr-frag-honeycomb-in',
		durationMs: Math.round(durationMs * 0.55),
		easing: 'ease-out',
		fragments,
	};
}

/**
 * Glitter: measured as a dense diamond-shaped sparkle dissolve (a
 * TV-static-like flicker of small diamonds) with a directional colour wipe
 * underneath. Capped at 9x6 = 54 diamonds.
 */
const GLITTER_COLS = 9;
const GLITTER_ROWS = 6;

export function glitterFragments(durationMs: number): FragmentedLayer {
	const fragments: TransitionFragment[] = [];
	const width = 100 / GLITTER_COLS;
	const height = 100 / GLITTER_ROWS;
	for (let row = 0; row < GLITTER_ROWS; row++) {
		for (let col = 0; col < GLITTER_COLS; col++) {
			const left = col * width;
			const top = row * height;
			const wave = (row + col) / (GLITTER_ROWS + GLITTER_COLS - 2);
			const jitter = seededUnit(row * 19 + col * 11);
			const delayMs = round((wave * 0.6 + jitter * 0.4) * durationMs * 0.7);
			fragments.push({
				id: `glitter-${row}-${col}`,
				clipPath: diamondClipPath(left, top, width, height),
				vars: {
					'--frag-flicker-rot': deg((seededUnit(row * 7 + col * 23) - 0.5) * 40),
				},
				delayMs,
				transformOrigin: `${round(left + width / 2)}% ${round(top + height / 2)}%`,
			});
		}
	}
	return {
		keyframesName: 'pptx-tr-frag-glitter-in',
		durationMs: Math.round(durationMs * 0.6),
		easing: 'ease-in-out',
		fragments,
	};
}
