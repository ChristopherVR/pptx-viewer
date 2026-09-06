/**
 * `ShapeStyle` (the resolved fill/line the renderer already computed) ->
 * `WFill` / `WLine` for the `.ppt` writer.
 *
 * @module ppt/writer/shape-style-to-fill-line
 */

import { EMU_PER_PX } from '../../constants';
import type { ShapeStyle } from '../../types/shape-style';
import type { WFill, WLine } from './write-model';

const DASH_NAMES = new Set([
	'solid',
	'dash',
	'dot',
	'dashDot',
	'lgDash',
	'lgDashDot',
	'lgDashDotDot',
]);

function strip(rgb: string | undefined): string | undefined {
	return rgb?.replace(/^#/u, '');
}

/** Resolve a shape's fill from its `ShapeStyle`. */
export function resolveFill(style: ShapeStyle | undefined): WFill | undefined {
	if (!style || style.fillMode === 'none') {
		return { kind: 'none' };
	}
	if (
		style.fillMode === 'gradient' &&
		style.fillGradientStops &&
		style.fillGradientStops.length > 0
	) {
		return {
			kind: 'gradient',
			angleDeg: style.fillGradientAngle ?? 0,
			stops: style.fillGradientStops.map((s) => ({
				rgb: strip(s.color) ?? '000000',
				position: s.position,
			})),
		};
	}
	if (style.fillColor) {
		return { kind: 'solid', rgb: strip(style.fillColor)! };
	}
	// Pattern/image/theme/group fills degrade to a representative solid: the
	// nearest true equivalent (msofillTexture/msofillPicture) needs an
	// embedded picture blip this writer does not fabricate for a fill.
	return { kind: 'none' };
}

/** Resolve a shape's outline from its `ShapeStyle`. */
export function resolveLine(style: ShapeStyle | undefined): WLine | undefined {
	if (!style || !style.strokeColor || style.strokeWidth === 0) {
		return { kind: 'none' };
	}
	const dash = style.strokeDash && DASH_NAMES.has(style.strokeDash) ? style.strokeDash : undefined;
	return {
		kind: 'line',
		rgb: strip(style.strokeColor)!,
		widthEmu: Math.max(1, Math.round((style.strokeWidth ?? 1) * EMU_PER_PX)),
		dash,
	};
}
