/**
 * Comparing two bindings' chart SVG captures.
 *
 * Split from `support/svg-fingerprint` (which owns the in-page capture and the
 * data shapes) so that neither file crosses the 300-line support-module cap.
 *
 * @module e2e/support/svg-diff
 */
import { stringsMatchWithColors } from './color-match';
import type { SvgChartFingerprint, SvgPrimitiveShape } from './svg-fingerprint';

/**
 * User-space drift allowed on primitive geometry.
 *
 * The values come off the shared view model, so they should agree outright;
 * measured drift on the full 14-slide gallery is confined to `getBBox()` float
 * noise on path outlines (well under half a unit). Anything past one unit is a
 * primitive genuinely drawn somewhere else or at another size.
 */
const GEOMETRY_TOLERANCE = 1;

/** Per-channel colour tolerance inside computed `fill` / `stroke` strings. */
const PAINT_COLOR_TOLERANCE = 3;

/**
 * Stable pairing key: tag plus geometry rounded to whole user-space units.
 *
 * Primitives are paired by sorting both sides with this key rather than by raw
 * DOM index, so a binding that emits the same marks in a different document
 * order (series-major vs category-major) is not reported as painting every
 * single bar differently.
 */
function sortKey(shape: SvgPrimitiveShape): string {
	return [
		shape.tag,
		...shape.geometry.map((value) => String(Math.round(value))),
		shape.fill,
		shape.stroke,
	].join('|');
}

function describeShape(shape: SvgPrimitiveShape): string {
	return `<${shape.tag}> at [${shape.geometry.join(', ')}]`;
}

/** Compare the painted non-text primitives of one chart, paired stably. */
function diffShapes(
	chartId: string,
	reference: SvgPrimitiveShape[],
	candidate: SvgPrimitiveShape[],
): string[] {
	const problems: string[] = [];
	const tags = new Set([...reference, ...candidate].map((shape) => shape.tag));
	for (const tag of tags) {
		const want = reference
			.filter((shape) => shape.tag === tag)
			.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
		const got = candidate
			.filter((shape) => shape.tag === tag)
			.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
		if (want.length !== got.length) {
			// The count mismatch is already reported from the primitive census;
			// index-wise pairing would only produce noise on top of it.
			continue;
		}
		want.forEach((expected, index) => {
			const actual = got[index];
			const label = `chart ${chartId} ${describeShape(expected)}`;
			for (const paintProperty of ['fill', 'stroke'] as const) {
				if (
					!stringsMatchWithColors(
						expected[paintProperty],
						actual[paintProperty],
						PAINT_COLOR_TOLERANCE,
					)
				) {
					problems.push(
						`${label}: ${paintProperty} is "${actual[paintProperty]}", reference has "${expected[paintProperty]}"`,
					);
				}
			}
			if (expected.strokeWidth !== actual.strokeWidth) {
				const widthDrift = Math.abs(
					Number.parseFloat(expected.strokeWidth) - Number.parseFloat(actual.strokeWidth),
				);
				// `!(x <= t)` so an unparseable width (NaN drift) is reported, not hidden.
				if (!(widthDrift <= 0.1)) {
					problems.push(
						`${label}: stroke-width is "${actual.strokeWidth}", reference has "${expected.strokeWidth}"`,
					);
				}
			}
			if (expected.geometry.length !== actual.geometry.length) {
				problems.push(
					`${label}: geometry [${actual.geometry.join(', ')}], reference has [${expected.geometry.join(', ')}]`,
				);
				return;
			}
			const drift = expected.geometry.map((value, axis) => Math.abs(value - actual.geometry[axis]));
			if (drift.some((value) => value > GEOMETRY_TOLERANCE)) {
				problems.push(
					`${label}: geometry [${actual.geometry.join(', ')}] drifts from the reference's [${expected.geometry.join(', ')}] by up to ${Math.max(...drift).toFixed(2)} user-space units`,
				);
			}
		});
	}
	return problems;
}

/** Every way a binding's charts disagree with the reference's, in plain lines. */
export function diffCharts(
	reference: SvgChartFingerprint[],
	candidate: SvgChartFingerprint[],
): string[] {
	const problems: string[] = [];
	const byId = new Map(candidate.map((chart) => [chart.elementId, chart]));

	for (const expected of reference) {
		const actual = byId.get(expected.elementId);
		if (!actual) {
			problems.push(`chart ${expected.elementId}: not rendered`);
			continue;
		}
		byId.delete(expected.elementId);

		if (expected.taggedAsElement !== actual.taggedAsElement) {
			problems.push(
				`chart ${expected.elementId}: data-pptx-element is ${
					actual.taggedAsElement ? 'set' : 'MISSING'
				}, reference has it ${expected.taggedAsElement ? 'set' : 'unset'} (the chart is not part of the neutral element contract in this binding)`,
			);
		}

		// The chart box is laid out by the binding, so allow a hair of rounding.
		if (Math.abs(expected.aspect - actual.aspect) > 0.02) {
			problems.push(
				`chart ${expected.elementId}: aspect ${actual.aspect} vs reference ${expected.aspect}`,
			);
		}

		for (const tag of new Set([
			...Object.keys(expected.primitives),
			...Object.keys(actual.primitives),
		])) {
			const want = expected.primitives[tag] ?? 0;
			const got = actual.primitives[tag] ?? 0;
			if (want !== got) {
				problems.push(
					`chart ${expected.elementId}: paints ${got} <${tag}> where the reference paints ${want}`,
				);
			}
		}

		problems.push(...diffShapes(expected.elementId, expected.shapes, actual.shapes));

		if (expected.texts.length !== actual.texts.length) {
			problems.push(
				`chart ${expected.elementId}: ${actual.texts.length} text nodes vs reference ${expected.texts.length}`,
			);
			continue;
		}
		expected.texts.forEach((want, index) => {
			const got = actual.texts[index];
			for (const key of [
				'text',
				'fontSize',
				'fontWeight',
				'fontFamily',
				'fill',
				'textAnchor',
				'transform',
			] as const) {
				if (want[key] !== got[key]) {
					problems.push(
						`chart ${expected.elementId} text #${index} ("${want.text}"): ${key} is "${got[key]}", reference has "${want[key]}"`,
					);
				}
			}
			for (const axis of ['x', 'y'] as const) {
				// User-space units straight off the shared view model: these should be
				// equal outright, so the allowance is only for float formatting.
				if (Math.abs(want[axis] - got[axis]) > 0.51) {
					problems.push(
						`chart ${expected.elementId} text #${index} ("${want.text}"): ${axis} is ${got[axis]}, reference has ${want[axis]}`,
					);
				}
			}
		});
	}

	for (const extra of byId.values()) {
		problems.push(`chart ${extra.elementId}: rendered, but the reference has no such chart`);
	}

	return problems;
}
