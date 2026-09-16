/** Opt-in artwork tokens. Defaults belong to each binding, not the theme root. */
export const SELECTION_CONTROL_CSS_VARS = {
	cornerSize: '--pptx-selection-corner-size',
	cornerRadius: '--pptx-selection-corner-radius',
	edgeLength: '--pptx-selection-edge-length',
	edgeThickness: '--pptx-selection-edge-thickness',
	edgeRadius: '--pptx-selection-edge-radius',
	handleFill: '--pptx-selection-handle-fill',
	handleBorderColor: '--pptx-selection-handle-border-color',
	outlineColor: '--pptx-selection-outline-color',
	rotateSize: '--pptx-selection-rotate-size',
	rotateFill: '--pptx-selection-rotate-fill',
	rotateForeground: '--pptx-selection-rotate-foreground',
} as const;

export type SelectionControlArtworkKind = 'corner' | 'horizontal-edge' | 'vertical-edge' | 'rotate';

/** Existing binding values, including responsive CSS fallbacks when needed. */
export interface SelectionControlArtworkDefaults {
	/** Positive screen-pixel lengths. Numbers mean px; strings may use local var(). */
	width: number | string;
	height: number | string;
	/** Local CSS radius, like the binding's existing border and shadow styling. */
	radius: string;
	fill: string;
	borderColor: string;
	foreground?: string;
}

const px = (value: number | string): string => (typeof value === 'number' ? `${value}px` : value);
const variable = (name: string, fallback: string): string => `var(${name}, ${fallback})`;

/**
 * Style a centered, aria-hidden artwork child, not the interactive hit region.
 * Callers retain their existing border width, shadow, anchors, hit padding and
 * neighbor partition. Frame dimensions never shrink below the binding default;
 * larger artwork grows the frame, while the existing partition still owns hits.
 * Center that frame on its anchor; fixed offsets for half the OLD width/height
 * would shift a growing control. Radius/borders/shadows keep local CSS units.
 *
 * inverseScale converts screen lengths to the binding's coordinate space. Use
 * 1 for an unscaled overlay or a button already inverse-scaled as a whole.
 * Defaults are trusted binding constants. var() falls back only for omitted
 * tokens; the helper does not read or sanitize arbitrary inherited CSS values.
 */
export function getSelectionControlArtworkStyle(
	kind: SelectionControlArtworkKind,
	defaults: SelectionControlArtworkDefaults,
	inverseScale = 1,
) {
	const tokens = SELECTION_CONTROL_CSS_VARS;
	const widthToken =
		kind === 'corner'
			? tokens.cornerSize
			: kind === 'rotate'
				? tokens.rotateSize
				: kind === 'horizontal-edge'
					? tokens.edgeLength
					: tokens.edgeThickness;
	const heightToken =
		kind === 'horizontal-edge'
			? tokens.edgeThickness
			: kind === 'vertical-edge'
				? tokens.edgeLength
				: widthToken;
	const width = variable(widthToken, px(defaults.width));
	const height = variable(heightToken, px(defaults.height));
	const length = (value: string): string =>
		inverseScale === 1 ? value : `calc(${value} * ${inverseScale})`;
	return {
		frame: {
			width: length(`max(${px(defaults.width)}, ${width})`),
			height: length(`max(${px(defaults.height)}, ${height})`),
		},
		artwork: {
			position: 'absolute' as const,
			left: '50%',
			top: '50%',
			transform: 'translate(-50%, -50%)',
			pointerEvents: 'none' as const,
			width: length(width),
			height: length(height),
			borderRadius:
				kind === 'rotate'
					? defaults.radius
					: variable(kind === 'corner' ? tokens.cornerRadius : tokens.edgeRadius, defaults.radius),
			background: variable(
				kind === 'rotate' ? tokens.rotateFill : tokens.handleFill,
				defaults.fill,
			),
			borderColor: variable(tokens.handleBorderColor, defaults.borderColor),
			...(kind === 'rotate'
				? { color: variable(tokens.rotateForeground, defaults.foreground ?? 'inherit') }
				: {}),
		},
	};
}

/** Shared by the selection outline and the binding's existing Rotate stem. */
export function getSelectionOutlineColor(fallback: string): string {
	return variable(SELECTION_CONTROL_CSS_VARS.outlineColor, fallback);
}
