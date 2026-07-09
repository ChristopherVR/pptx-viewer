/**
 * CSS flattening passes for print/export fidelity. These operate on cloned DOM
 * subtrees (never the live document) and are designed to run inside
 * html2canvas's `onclone` callback. Pure DOM helpers (no framework imports),
 * shared by every binding's export pipeline.
 *
 * html2canvas has limited CSS support; each pass below replaces a feature it
 * cannot render with an approximation it can: backdrop-filter, mix-blend-mode,
 * 3D transforms, and assorted unsupported properties.
 */
/* eslint-disable require-unicode-regexp, prefer-named-capture-group -- these
   are ASCII-only CSS-token regexes (colour functions, transform tokens,
   units); the `u` flag and named groups are stylistic noise here. */

/* ------------------------------------------------------------------ */
/*  Backdrop-filter Flattening                                         */
/* ------------------------------------------------------------------ */

/**
 * Parse a blur value from a CSS filter string (e.g. "blur(10px)").
 * Returns the pixel value or 0 if not found.
 */
export function parseBlurValue(filter: string): number {
	const match = filter.match(/blur\(\s*([\d.]+)\s*px\s*\)/i);
	return match ? parseFloat(match[1]) : 0;
}

/**
 * Replace backdrop-filter with an approximated visual equivalent.
 *
 * html2canvas does not support backdrop-filter at all. For blur effects,
 * we add a semi-transparent background to simulate the frosted-glass
 * appearance. For other backdrop-filter functions, we remove them
 * but preserve any existing background.
 */
export function flattenBackdropFilter(root: HTMLElement): void {
	const elements = root.querySelectorAll('*');
	const view = root.ownerDocument?.defaultView ?? window;

	const flatten = (el: Element) => {
		const htmlEl = el as HTMLElement;
		if (!htmlEl.style) {
			return;
		}

		const computed = view.getComputedStyle(htmlEl);
		const backdropFilter =
			computed.getPropertyValue('backdrop-filter') ||
			computed.getPropertyValue('-webkit-backdrop-filter');

		if (!backdropFilter || backdropFilter === 'none') {
			return;
		}

		const blurPx = parseBlurValue(backdropFilter);

		htmlEl.style.setProperty('backdrop-filter', 'none');
		htmlEl.style.setProperty('-webkit-backdrop-filter', 'none');

		if (blurPx > 0) {
			const currentBg = computed.getPropertyValue('background-color');
			if (!currentBg || currentBg === 'transparent' || currentBg === 'rgba(0, 0, 0, 0)') {
				const opacity = Math.min(0.85, 0.4 + blurPx * 0.02);
				htmlEl.style.setProperty('background-color', `rgba(255, 255, 255, ${opacity.toFixed(2)})`);
			}
		}
	};

	flatten(root);
	elements.forEach(flatten);
}

/* ------------------------------------------------------------------ */
/*  Mix-blend-mode Flattening                                          */
/* ------------------------------------------------------------------ */

/**
 * Mapping of blend modes to approximate opacity values.
 * These rough approximations preserve some visual character
 * when the blend mode cannot be rendered.
 */
const BLEND_MODE_OPACITY_MAP: Record<string, number> = {
	multiply: 0.85,
	screen: 0.9,
	overlay: 0.8,
	darken: 0.9,
	lighten: 0.9,
	'color-dodge': 0.85,
	'color-burn': 0.85,
	'hard-light': 0.8,
	'soft-light': 0.9,
	difference: 0.7,
	exclusion: 0.75,
	hue: 0.85,
	saturation: 0.85,
	color: 0.85,
	luminosity: 0.85,
};

/**
 * Replace mix-blend-mode with an opacity approximation.
 *
 * html2canvas does not support mix-blend-mode. We reset it to
 * "normal" and apply a rough opacity adjustment based on the
 * original blend mode to preserve some visual weight.
 */
export function flattenMixBlendMode(root: HTMLElement): void {
	const elements = root.querySelectorAll('*');
	const view = root.ownerDocument?.defaultView ?? window;

	const flatten = (el: Element) => {
		const htmlEl = el as HTMLElement;
		if (!htmlEl.style) {
			return;
		}

		const computed = view.getComputedStyle(htmlEl);
		const blendMode = computed.getPropertyValue('mix-blend-mode');

		if (!blendMode || blendMode === 'normal') {
			return;
		}

		htmlEl.style.setProperty('mix-blend-mode', 'normal');

		const currentOpacity = parseFloat(computed.getPropertyValue('opacity') || '1');
		const blendOpacity = BLEND_MODE_OPACITY_MAP[blendMode] ?? 1;
		const combinedOpacity = currentOpacity * blendOpacity;

		if (combinedOpacity < 1) {
			htmlEl.style.setProperty('opacity', combinedOpacity.toFixed(2));
		}
	};

	flatten(root);
	elements.forEach(flatten);
}

/* ------------------------------------------------------------------ */
/*  3D Transform Flattening                                            */
/* ------------------------------------------------------------------ */

/**
 * Matches the *start* of a 3D transform function call (name + opening
 * paren) in a CSS transform value. Deliberately does not also match through
 * to the closing paren: this is used only to detect whether a 3D function is
 * present, and requiring `[^)]*\)` after the alternation made the pattern
 * retry an unbounded scan-to-end at every occurrence of a 3D function name in
 * the input. On a crafted value with many repeated `scaleZ(` (etc.)
 * substrings and no closing paren, that produced quadratic (polynomial-
 * ReDoS) behaviour. Matching just the name + `(` keeps each attempt O(1),
 * so scanning the whole string stays linear. The actual argument parsing
 * (which needs the closing paren) happens separately, per-function, below.
 */
const TRANSFORM_3D_RE =
	/(?:translate3d|rotate3d|scale3d|matrix3d|perspective|translateZ|rotateX|rotateY|scaleZ)\s*\(/gi;

/**
 * Check whether a CSS transform value contains 3D transform functions.
 * Uses a fresh regex test each time to avoid global regex lastIndex issues.
 */
export function has3dTransform(transformValue: string): boolean {
	if (!transformValue || transformValue === 'none') {
		return false;
	}
	const re =
		/(?:translate3d|rotate3d|scale3d|matrix3d|perspective|translateZ|rotateX|rotateY|scaleZ)\s*\(/i;
	return re.test(transformValue);
}

/**
 * Flatten 3D CSS transforms to their 2D equivalents.
 *
 * html2canvas has incomplete support for 3D transforms. We extract
 * the 2D components where possible and discard the Z-axis movements.
 *
 * - `translate3d(x, y, z)` -> `translate(x, y)`
 * - `translateZ(z)` -> removed
 * - `scale3d(x, y, z)` -> `scale(x, y)`
 * - `scaleZ(z)` -> removed
 * - `rotateX(a)` / `rotateY(a)` -> removed (3D rotation)
 * - `perspective(...)` -> removed
 * - `matrix3d(...)` -> uses computed 2D matrix if available
 */
export function flatten3dTransform(transformValue: string): string {
	if (!transformValue || transformValue === 'none') {
		return transformValue;
	}

	TRANSFORM_3D_RE.lastIndex = 0;

	if (!TRANSFORM_3D_RE.test(transformValue)) {
		return transformValue;
	}
	TRANSFORM_3D_RE.lastIndex = 0;

	let result = transformValue;

	// `translate3d(x, y, z)` -> `translate(x, y)` and `scale3d(x, y, z)` ->
	// `scale(x, y)`. Previously these used a single regex with adjacent
	// `([^,]+)\s*` groups (e.g. `\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\)`). Since
	// `[^,]+` can itself consume whitespace, that whitespace could be
	// attributed to either the capture group or the following `\s*` in many
	// different ways, so a value with many repeated spaces before a missing
	// terminator (e.g. `translate3d(` followed by thousands of spaces) forced
	// the regex engine through an exponential number of backtracking
	// partitions (polynomial/catastrophic ReDoS). Splitting this into an
	// unambiguous boundary match (`[^)]*` has no overlapping quantifier) plus
	// plain string `split`/`trim` for the argument list removes the ambiguity
	// entirely.
	// Args may themselves contain one level of nested parens (e.g.
	// `translate3d(calc(50% - 10px), 20px, 0)`), so the boundary match allows
	// a single `(...)` nesting rather than stopping at the first `)`. Each
	// nested group requires a literal `(` to start, so there is no ambiguity
	// in how repetitions are split, unlike the old adjacent-quantifier
	// pattern.
	result = result.replace(
		/translate3d\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi,
		(match, args: string) => {
			const parts = args.split(',');
			// Mirrors the old regex's requirement of at least two commas (x, y,
			// z[, ...]); extra segments beyond the third are ignored, same as
			// the old greedy `[^)]+` z-argument absorbing them.
			if (parts.length < 3) {
				return match;
			}
			return `translate(${parts[0].trim()}, ${parts[1].trim()})`;
		},
	);

	result = result.replace(/translateZ\([^)]*\)/gi, '');

	result = result.replace(/scale3d\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi, (match, args: string) => {
		const parts = args.split(',');
		if (parts.length < 3) {
			return match;
		}
		return `scale(${parts[0].trim()}, ${parts[1].trim()})`;
	});

	result = result.replace(/scaleZ\([^)]*\)/gi, '');

	result = result.replace(/rotate[XY]\([^)]*\)/gi, '');

	result = result.replace(/rotate3d\([^)]*\)/gi, '');

	result = result.replace(/perspective\([^)]*\)/gi, '');

	result = result.replace(/matrix3d\(([^)]*)\)/gi, (_match, args: string) => {
		const vals = args.split(',').map((v: string) => parseFloat(v.trim()));
		if (vals.length === 16 && vals.every((v: number) => !isNaN(v))) {
			return `matrix(${vals[0]}, ${vals[1]}, ${vals[4]}, ${vals[5]}, ${vals[12]}, ${vals[13]})`;
		}
		return '';
	});

	result = result.replace(/\s{2,}/g, ' ').trim();

	if (!result) {
		return 'none';
	}

	if (result === 'matrix(1, 0, 0, 1, 0, 0)') {
		return 'none';
	}

	return result;
}

/**
 * Walk the cloned DOM and flatten 3D transforms to 2D equivalents.
 */
export function flatten3dTransforms(root: HTMLElement): void {
	const elements = root.querySelectorAll('*');
	const view = root.ownerDocument?.defaultView ?? window;

	const flatten = (el: Element) => {
		const htmlEl = el as HTMLElement;
		if (!htmlEl.style) {
			return;
		}

		const computed = view.getComputedStyle(htmlEl);
		const transform = computed.getPropertyValue('transform');

		if (!transform || transform === 'none') {
			return;
		}

		TRANSFORM_3D_RE.lastIndex = 0;
		if (TRANSFORM_3D_RE.test(transform)) {
			TRANSFORM_3D_RE.lastIndex = 0;
			const flattened = flatten3dTransform(transform);
			htmlEl.style.setProperty('transform', flattened);
		}
	};

	flatten(root);
	elements.forEach(flatten);
}

/* ------------------------------------------------------------------ */
/*  Unsupported CSS Feature Removal                                    */
/* ------------------------------------------------------------------ */

/**
 * Remove CSS features that html2canvas cannot handle at all:
 * - `mask` / `mask-image` (partial support)
 * - `clip-path` with complex shapes (path() partially supported)
 * - `filter` functions beyond basic blur/opacity
 * - `-webkit-text-stroke` (not supported)
 * - `writing-mode: vertical-*` (limited support)
 */
export function removeUnsupportedFeatures(root: HTMLElement): void {
	const elements = root.querySelectorAll('*');
	const view = root.ownerDocument?.defaultView ?? window;

	const clean = (el: Element) => {
		const htmlEl = el as HTMLElement;
		if (!htmlEl.style) {
			return;
		}

		const computed = view.getComputedStyle(htmlEl);

		const maskImage =
			computed.getPropertyValue('mask-image') || computed.getPropertyValue('-webkit-mask-image');
		if (maskImage && maskImage !== 'none') {
			if (maskImage.includes('url(') && !maskImage.includes('data:')) {
				htmlEl.style.setProperty('mask-image', 'none');
				htmlEl.style.setProperty('-webkit-mask-image', 'none');
			}
		}

		const boxReflect = computed.getPropertyValue('-webkit-box-reflect');
		if (boxReflect && boxReflect !== 'none') {
			htmlEl.style.setProperty('-webkit-box-reflect', 'none');
		}

		const textStroke = computed.getPropertyValue('-webkit-text-stroke');
		if (textStroke && textStroke !== '0px' && textStroke !== '0px rgb(0, 0, 0)') {
			const strokeMatch = textStroke.match(/([\d.]+)px\s+(.*)/);
			if (strokeMatch) {
				const width = parseFloat(strokeMatch[1]);
				const colour = strokeMatch[2] || 'black';
				const offsets = [
					[width, 0],
					[-width, 0],
					[0, width],
					[0, -width],
				];
				const shadows = offsets.map(([x, y]) => `${x}px ${y}px 0 ${colour}`).join(', ');
				const existing = computed.getPropertyValue('text-shadow');
				const combined = existing && existing !== 'none' ? `${existing}, ${shadows}` : shadows;
				htmlEl.style.setProperty('text-shadow', combined);
				htmlEl.style.setProperty('-webkit-text-stroke', '0');
			}
		}
	};

	clean(root);
	elements.forEach(clean);
}
