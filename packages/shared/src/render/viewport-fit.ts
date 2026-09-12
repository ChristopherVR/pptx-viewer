/** Unscaled CSS pixels reserved on each side of the ordinary viewer viewport. */
export type ViewportFitPadding = number | { horizontal: number; vertical: number };

/** Host layout policy, independent of authored slide dimensions and user zoom. */
export interface ViewportFitOptions {
	/** Per-side padding. Omission keeps the binding's existing decorative allowance. */
	fitPadding?: ViewportFitPadding;
	/** Positive fit-factor ceiling; null allows enlargement without a ceiling. */
	maxFitScale?: number | null;
}

export interface ResolvedViewportFitOptions {
	fitPadding: { horizontal: number; vertical: number };
	maxFitScale: number | null;
}

const DEFAULTS: ResolvedViewportFitOptions = {
	fitPadding: { horizontal: 0, vertical: 0 },
	maxFitScale: null,
};

function validPadding(value: number, fallback: number): number {
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Normalize once for both fit measurement and a binding's physical viewport CSS. */
export function resolveViewportFitOptions(
	options: ViewportFitOptions = {},
	defaults: Required<ViewportFitOptions> = DEFAULTS,
): ResolvedViewportFitOptions {
	const base =
		typeof defaults.fitPadding === 'number'
			? { horizontal: defaults.fitPadding, vertical: defaults.fitPadding }
			: defaults.fitPadding;
	const padding = options.fitPadding ?? base;
	const horizontal = typeof padding === 'number' ? padding : padding.horizontal;
	const vertical = typeof padding === 'number' ? padding : padding.vertical;
	const cap = options.maxFitScale;
	return {
		fitPadding: {
			horizontal: validPadding(horizontal, base.horizontal),
			vertical: validPadding(vertical, base.vertical),
		},
		maxFitScale:
			cap === null
				? null
				: typeof cap === 'number' && Number.isFinite(cap) && cap > 0
					? cap
					: defaults.maxFitScale,
	};
}

export interface ViewportFitInput extends ViewportFitOptions {
	viewportWidth: number;
	viewportHeight: number;
	canvasWidth: number;
	canvasHeight: number;
	/** Existing layout reservation, separate from the host's decorative padding. */
	horizontalGutter?: number;
	verticalGutter?: number;
	/** Used until a usable viewport and authored canvas can be measured. */
	fallbackScale?: number;
}

export interface ViewportFitResult {
	scale: number;
	availableWidth: number;
	availableHeight: number;
}

/** Calculate fit only: the user's zoom factor is applied separately by the viewer. */
export function calculateViewportFit(
	input: ViewportFitInput,
	defaults: Required<ViewportFitOptions> = DEFAULTS,
): ViewportFitResult {
	const { fitPadding, maxFitScale } = resolveViewportFitOptions(input, defaults);
	const availableWidth = Math.max(
		0,
		validPadding(input.viewportWidth, 0) -
			2 * fitPadding.horizontal -
			validPadding(input.horizontalGutter ?? 0, 0),
	);
	const availableHeight = Math.max(
		0,
		validPadding(input.viewportHeight, 0) -
			2 * fitPadding.vertical -
			validPadding(input.verticalGutter ?? 0, 0),
	);
	const fallback =
		typeof input.fallbackScale === 'number' &&
		Number.isFinite(input.fallbackScale) &&
		input.fallbackScale > 0
			? input.fallbackScale
			: 1;
	const validCanvas =
		Number.isFinite(input.canvasWidth) &&
		input.canvasWidth > 0 &&
		Number.isFinite(input.canvasHeight) &&
		input.canvasHeight > 0;
	const scale =
		availableWidth > 0 && availableHeight > 0 && validCanvas
			? Math.min(
					availableWidth / input.canvasWidth,
					availableHeight / input.canvasHeight,
					maxFitScale ?? Number.POSITIVE_INFINITY,
				)
			: fallback;
	return {
		scale: Number.isFinite(scale) && scale > 0 ? scale : fallback,
		availableWidth,
		availableHeight,
	};
}
