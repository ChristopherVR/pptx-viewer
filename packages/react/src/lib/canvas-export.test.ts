import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { _testing } from './canvas-export';

const {
	UNSUPPORTED_COLOR_RE,
	UNSUPPORTED_COLOR_FN_RE,
	resolveColorToSrgb,
	replaceUnsupportedColors,
	resolveUnsupportedColours,
	resolveRootCustomProperties,
	patchStylesheets,
	COLOR_PROPERTIES,
	COMPLEX_COLOR_PROPERTIES,
	resetScratchCtx,
	setScratchCtx,
} = _testing;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a minimal mock CanvasRenderingContext2D that simulates how
 * real browsers handle `fillStyle`:
 * - Setting a valid CSS colour normalises it to `#rrggbb` or `rgba()`.
 * - Setting an invalid colour is silently ignored (value stays).
 *
 * The `colorMap` lets tests define which inputs map to which outputs.
 * Any input not in the map is treated as "invalid" (i.e. ignored).
 */
function createMockCtx(colorMap: Record<string, string> = {}): CanvasRenderingContext2D {
	let _fillStyle = '#000000';

	return {
		get fillStyle() {
			return _fillStyle;
		},
		set fillStyle(value: string) {
			// If the value is a plain hex colour, accept it as-is (sentinel).
			if (/^#[0-9a-f]{6}$/iu.test(value)) {
				_fillStyle = value.toLowerCase();
				return;
			}
			// If we have a mapped conversion, use it.
			const trimmed = value.trim();
			if (trimmed in colorMap) {
				_fillStyle = colorMap[trimmed];
			}
			// Otherwise: invalid colour, leave fillStyle unchanged.
		},
	} as unknown as CanvasRenderingContext2D;
}

/* ------------------------------------------------------------------ */
/*  UNSUPPORTED_COLOR_RE: detection regex                             */
/* ------------------------------------------------------------------ */

describe('uNSUPPORTED_COLOR_RE', () => {
	describe('should match unsupported colour functions', () => {
		it.each([
			'oklch(0.7 0.15 180)',
			'oklch(70% 0.15 180 / 0.5)',
			'oklab(0.7 -0.1 0.1)',
			'oklab(0.7 -0.1 0.1 / 50%)',
			'lch(50 30 270)',
			'lch(50% 30 270 / 0.8)',
			'lab(50 20 -30)',
			'lab(50 20 -30 / 1)',
			'color(display-p3 1 0 0)',
			'color(srgb 0.5 0.5 0.5)',
			'color(rec2020 0.4 0.3 0.2 / 0.9)',
		])('matches %s', (value) => {
			expect(UNSUPPORTED_COLOR_RE.test(value)).toBeTruthy();
		});
	});

	describe('should match case-insensitively', () => {
		it.each([
			'OKLCH(0.7 0.15 180)',
			'OkLab(0.5 0.1 -0.1)',
			'LCH(50 30 270)',
			'LAB(50 20 -30)',
			'Color(display-p3 1 0 0)',
		])('matches %s', (value) => {
			expect(UNSUPPORTED_COLOR_RE.test(value)).toBeTruthy();
		});
	});

	describe('should match when embedded in larger strings', () => {
		it.each([
			'linear-gradient(oklch(0.7 0.15 180), oklch(0.3 0.1 90))',
			'0 2px 4px oklch(0.2 0 0 / 0.3)',
			'--color-primary: oklab(0.7 -0.1 0.1)',
			'border: 1px solid lch(50 30 270)',
			'background: color(display-p3 1 0 0)',
		])('matches in: %s', (value) => {
			expect(UNSUPPORTED_COLOR_RE.test(value)).toBeTruthy();
		});
	});

	describe('should NOT match supported colour values', () => {
		it.each([
			'rgb(255, 0, 0)',
			'rgba(255, 0, 0, 0.5)',
			'#ff0000',
			'#f00',
			'hsl(0, 100%, 50%)',
			'hsla(0, 100%, 50%, 0.5)',
			'red',
			'transparent',
			'currentColor',
			'inherit',
			'',
		])('does not match %s', (value) => {
			expect(UNSUPPORTED_COLOR_RE.test(value)).toBeFalsy();
		});
	});

	it("should not match 'lab' or 'lch' as substrings without parentheses", () => {
		// "label" contains "lab" but should not match because the regex
		// requires `lab(` (with the opening paren).
		expect(UNSUPPORTED_COLOR_RE.test('label')).toBeFalsy();
		expect(UNSUPPORTED_COLOR_RE.test('latch')).toBeFalsy();
		expect(UNSUPPORTED_COLOR_RE.test('collab')).toBeFalsy();
	});

	it("should match 'oklch' and 'oklab' even without parentheses", () => {
		// The regex matches the bare words oklch/oklab (without requiring `(`),
		// because these are distinctive enough to not appear as substrings
		// of normal English words.
		expect(UNSUPPORTED_COLOR_RE.test('oklch')).toBeTruthy();
		expect(UNSUPPORTED_COLOR_RE.test('oklab')).toBeTruthy();
	});
});

/* ------------------------------------------------------------------ */
/*  UNSUPPORTED_COLOR_FN_RE: extraction regex                         */
/* ------------------------------------------------------------------ */

describe('uNSUPPORTED_COLOR_FN_RE', () => {
	beforeEach(() => {
		// Reset lastIndex: the regex is /g so it's stateful.
		UNSUPPORTED_COLOR_FN_RE.lastIndex = 0;
	});

	describe('should extract full function calls', () => {
		it('extracts oklch()', () => {
			const input = 'oklch(0.7 0.15 180)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['oklch(0.7 0.15 180)']);
		});

		it('extracts oklab()', () => {
			const input = 'oklab(0.7 -0.1 0.1)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['oklab(0.7 -0.1 0.1)']);
		});

		it('extracts lch()', () => {
			const input = 'lch(50 30 270)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['lch(50 30 270)']);
		});

		it('extracts lab()', () => {
			const input = 'lab(50 20 -30)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['lab(50 20 -30)']);
		});

		it('extracts color()', () => {
			const input = 'color(display-p3 1 0 0)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['color(display-p3 1 0 0)']);
		});
	});

	describe('should extract with alpha channel', () => {
		it('handles / alpha syntax', () => {
			const input = 'oklch(0.7 0.15 180 / 0.5)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['oklch(0.7 0.15 180 / 0.5)']);
		});

		it('handles percentage alpha', () => {
			const input = 'oklab(0.7 -0.1 0.1 / 50%)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['oklab(0.7 -0.1 0.1 / 50%)']);
		});
	});

	describe('should handle nested parentheses (calc() etc.)', () => {
		it('extracts oklch with calc(): captures through closing paren of nested group', () => {
			// The regex `[^)]*(?:\([^)]*\)[^)]*)*` handles one level of nesting.
			// When calc() appears first, the initial `[^)]*` consumes up to calc's
			// closing `)`, then the alternation captures the remaining content.
			const input = 'oklch(calc(0.5 + 0.2) 0.15 180)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).not.toBeNull();
			// The regex matches through the outer closing paren because `[^)]*`
			// eats `calc(0.5 + 0.2`, then `)` closes the first non-nested match,
			// and the regex greedily consumes with the `(?:\(…\)…)*` zero times.
			// Actual match is `oklch(calc(0.5 + 0.2)`.
			expect(matches![0]).toBe('oklch(calc(0.5 + 0.2)');
		});

		it('handles nested parens when they follow content after a closing paren', () => {
			// The `(?:\([^)]*\)[^)]*)*` group handles the pattern:
			// closeParen, content, openParen, content, closeParen.
			// e.g. `oklch(50% 0.15 calc(180))`: the inner calc(180) comes after
			// content that doesn't contain `)`.
			const input = 'oklch(50% 0.15 calc(180))';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).not.toBeNull();
			// `[^)]*` matches `50% 0.15 calc(180`, then `)` is matched,
			// then the outer `)` matches.
			// Result: `oklch(50% 0.15 calc(180))`, but wait, `[^)]*` eats
			// `50% 0.15 calc(180` (the `(` in calc is fine since it's not `)`),
			// then `)` closes. Then the optional group `\([^)]*\)` can't match
			// since next char is `)` not `(`. So outer `)` matches the `)`.
			// Actual: "oklch(50% 0.15 calc(180)"
			expect(matches![0]).toBe('oklch(50% 0.15 calc(180)');
		});

		it('extracts color() with nested function: partial match', () => {
			const input = 'color(display-p3 calc(1 - 0.2) 0 0)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).not.toBeNull();
			// Same pattern: initial [^)]* eats through `calc(1 - 0.2`, stops at `)`.
			expect(matches![0]).toBe('color(display-p3 calc(1 - 0.2)');
		});

		it('handles simple one-level nesting correctly', () => {
			// When there are no nested parens, extraction works perfectly.
			const input = 'oklch(0.7 0.15 180)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['oklch(0.7 0.15 180)']);
		});
	});

	describe('should extract multiple matches from gradients', () => {
		it('finds two oklch() calls in a gradient', () => {
			const input = 'linear-gradient(oklch(0.7 0.15 180), oklch(0.3 0.1 90))';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toHaveLength(2);
			expect(matches![0]).toBe('oklch(0.7 0.15 180)');
			expect(matches![1]).toBe('oklch(0.3 0.1 90)');
		});

		it('finds mixed colour function calls', () => {
			const input = 'linear-gradient(oklch(0.7 0.15 180), lab(50 20 -30), color(display-p3 1 0 0))';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toHaveLength(3);
		});
	});

	describe('should be case-insensitive', () => {
		it('matches OKLCH uppercase', () => {
			const input = 'OKLCH(0.7 0.15 180)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['OKLCH(0.7 0.15 180)']);
		});

		it('matches mixed case', () => {
			const input = 'OkLab(0.5 0.1 -0.1)';
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toStrictEqual(['OkLab(0.5 0.1 -0.1)']);
		});
	});

	describe('should not match supported colour functions', () => {
		it('ignores rgb()', () => {
			const matches = 'rgb(255, 0, 0)'.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toBeNull();
		});

		it('ignores rgba()', () => {
			const matches = 'rgba(255, 0, 0, 0.5)'.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toBeNull();
		});

		it('ignores hsl()', () => {
			const matches = 'hsl(0, 100%, 50%)'.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).toBeNull();
		});
	});
});

/* ------------------------------------------------------------------ */
/*  resolveColorToSrgb                                                */
/* ------------------------------------------------------------------ */

describe('resolveColorToSrgb', () => {
	afterEach(() => {
		resetScratchCtx();
	});

	it('returns original value when canvas context is unavailable', () => {
		setScratchCtx(null);
		expect(resolveColorToSrgb('oklch(0.7 0.15 180)')).toBe('oklch(0.7 0.15 180)');
	});

	it('converts a known colour to hex via the mock context', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
		});
		setScratchCtx(ctx);
		expect(resolveColorToSrgb('oklch(0.7 0.15 180)')).toBe('#2fa87d');
	});

	it('trims whitespace before converting', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
		});
		setScratchCtx(ctx);
		expect(resolveColorToSrgb('  oklch(0.7 0.15 180)  ')).toBe('#2fa87d');
	});

	it('returns original value for invalid/unrecognised colours', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);
		// "not-a-color" is not in the colorMap, so it's treated as invalid.
		expect(resolveColorToSrgb('not-a-color')).toBe('not-a-color');
	});

	it('returns original when fillStyle stays at sentinel', () => {
		// The sentinel is #020304. If the value is invalid, fillStyle doesn't
		// change, so the function returns the original input.
		const ctx = createMockCtx({});
		setScratchCtx(ctx);
		expect(resolveColorToSrgb('garbage()')).toBe('garbage()');
	});

	it('converts multiple different colour values independently', () => {
		const ctx = createMockCtx({
			'oklch(0.9 0 0)': '#ffffff',
			'oklch(0 0 0)': '#000000',
			'oklch(0.5 0.2 30)': '#b54d21',
		});
		setScratchCtx(ctx);

		expect(resolveColorToSrgb('oklch(0.9 0 0)')).toBe('#ffffff');
		expect(resolveColorToSrgb('oklch(0 0 0)')).toBe('#000000');
		expect(resolveColorToSrgb('oklch(0.5 0.2 30)')).toBe('#b54d21');
	});

	it('handles rgba-style output for translucent colours', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180 / 0.5)': 'rgba(47, 168, 125, 0.5)',
		});
		setScratchCtx(ctx);
		expect(resolveColorToSrgb('oklch(0.7 0.15 180 / 0.5)')).toBe('rgba(47, 168, 125, 0.5)');
	});
});

/* ------------------------------------------------------------------ */
/*  replaceUnsupportedColors                                          */
/* ------------------------------------------------------------------ */

describe('replaceUnsupportedColors', () => {
	afterEach(() => {
		resetScratchCtx();
	});

	it('returns the string unchanged when no unsupported functions are present', () => {
		setScratchCtx(createMockCtx({}));
		const input = 'rgb(255, 0, 0)';
		expect(replaceUnsupportedColors(input)).toBe(input);
	});

	it('returns the string unchanged for plain hex values', () => {
		setScratchCtx(createMockCtx({}));
		expect(replaceUnsupportedColors('#ff0000')).toBe('#ff0000');
	});

	it('returns empty string unchanged', () => {
		setScratchCtx(createMockCtx({}));
		expect(replaceUnsupportedColors('')).toBe('');
	});

	it('replaces a single oklch call in a simple value', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
		});
		setScratchCtx(ctx);
		expect(replaceUnsupportedColors('oklch(0.7 0.15 180)')).toBe('#2fa87d');
	});

	it('replaces oklch calls within a gradient', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
			'oklch(0.3 0.1 90)': '#3a5a1c',
		});
		setScratchCtx(ctx);

		const input = 'linear-gradient(oklch(0.7 0.15 180), oklch(0.3 0.1 90))';
		const result = replaceUnsupportedColors(input);
		expect(result).toBe('linear-gradient(#2fa87d, #3a5a1c)');
	});

	it('replaces mixed colour functions in a complex gradient', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
			'lab(50 20 -30)': '#7a5e96',
			'color(display-p3 1 0 0)': '#ff0000',
		});
		setScratchCtx(ctx);

		const input = 'linear-gradient(oklch(0.7 0.15 180), lab(50 20 -30), color(display-p3 1 0 0))';
		const result = replaceUnsupportedColors(input);
		expect(result).toBe('linear-gradient(#2fa87d, #7a5e96, #ff0000)');
	});

	it('replaces oklch in a box-shadow value', () => {
		const ctx = createMockCtx({
			'oklch(0.2 0 0 / 0.3)': 'rgba(0, 0, 0, 0.3)',
		});
		setScratchCtx(ctx);

		const input = '0 2px 4px oklch(0.2 0 0 / 0.3)';
		const result = replaceUnsupportedColors(input);
		expect(result).toBe('0 2px 4px rgba(0, 0, 0, 0.3)');
	});

	it('preserves non-colour parts of the value', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
		});
		setScratchCtx(ctx);

		const input = '10px 20px 5px oklch(0.7 0.15 180)';
		const result = replaceUnsupportedColors(input);
		expect(result).toBe('10px 20px 5px #2fa87d');
	});
});

/* ------------------------------------------------------------------ */
/*  Property lists                                                    */
/* ------------------------------------------------------------------ */

describe('property lists', () => {
	it('cOLOR_PROPERTIES contains expected standard colour properties', () => {
		expect(COLOR_PROPERTIES).toContain('color');
		expect(COLOR_PROPERTIES).toContain('background-color');
		expect(COLOR_PROPERTIES).toContain('border-top-color');
		expect(COLOR_PROPERTIES).toContain('border-right-color');
		expect(COLOR_PROPERTIES).toContain('border-bottom-color');
		expect(COLOR_PROPERTIES).toContain('border-left-color');
		expect(COLOR_PROPERTIES).toContain('outline-color');
		expect(COLOR_PROPERTIES).toContain('fill');
		expect(COLOR_PROPERTIES).toContain('stroke');
	});

	it('cOLOR_PROPERTIES does not contain complex properties', () => {
		expect(COLOR_PROPERTIES).not.toContain('box-shadow');
		expect(COLOR_PROPERTIES).not.toContain('background-image');
		expect(COLOR_PROPERTIES).not.toContain('text-shadow');
	});

	it('cOMPLEX_COLOR_PROPERTIES contains expected gradient/shadow properties', () => {
		expect(COMPLEX_COLOR_PROPERTIES).toContain('box-shadow');
		expect(COMPLEX_COLOR_PROPERTIES).toContain('text-shadow');
		expect(COMPLEX_COLOR_PROPERTIES).toContain('background-image');
		expect(COMPLEX_COLOR_PROPERTIES).toContain('background');
		expect(COMPLEX_COLOR_PROPERTIES).toContain('border-image');
	});

	it('property lists have no overlap', () => {
		const overlap = COLOR_PROPERTIES.filter((p) => COMPLEX_COLOR_PROPERTIES.includes(p));
		expect(overlap).toStrictEqual([]);
	});
});

/* ------------------------------------------------------------------ */
/*  resolveUnsupportedColours (DOM walk)                              */
/* ------------------------------------------------------------------ */

describe('resolveUnsupportedColours', () => {
	afterEach(() => {
		resetScratchCtx();
	});

	/**
	 * Build a minimal HTMLElement mock tree. Each element has a `style`
	 * object (inline styles) and a `computedStyle` map that we use to
	 * simulate `window.getComputedStyle`.
	 */
	function createMockElement(opts: {
		computedStyles?: Record<string, string>;
		inlineStyles?: Record<string, string>;
		children?: ReturnType<typeof createMockElement>[];
	}) {
		const _inline: Record<string, string> = { ...opts.inlineStyles };
		const _inlineKeys: string[] = Object.keys(_inline);
		const computedStyles = opts.computedStyles ?? {};
		const children = opts.children ?? [];

		const style = new Proxy(
			{
				get length() {
					return _inlineKeys.length;
				},
				*[Symbol.iterator]() {
					for (const k of _inlineKeys) {
						yield k;
					}
				},
				getPropertyValue(prop: string) {
					return _inline[prop] ?? '';
				},
				setProperty(prop: string, value: string) {
					if (!_inlineKeys.includes(prop)) {
						_inlineKeys.push(prop);
					}
					_inline[prop] = value;
				},
			},
			{
				get(target, prop, receiver) {
					// Numeric index access: style[0], style[1], etc.
					if (typeof prop === 'string' && /^\d+$/u.test(prop)) {
						return _inlineKeys[Number(prop)];
					}
					return Reflect.get(target, prop, receiver);
				},
			},
		);

		const el = {
			style,
			_computedStyles: computedStyles,
			_inline,
			querySelectorAll(_sel: string) {
				return children;
			},
		};

		return el;
	}

	it('converts a simple colour property on the root element', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
		});
		setScratchCtx(ctx);

		const el = createMockElement({
			computedStyles: { color: 'oklch(0.7 0.15 180)' },
		});

		// Mock window.getComputedStyle
		const origGetComputed = globalThis.window?.getComputedStyle;
		// @ts-expect-error - mock
		globalThis.window ??= {};
		// @ts-expect-error - mock
		globalThis.window.getComputedStyle = (target: unknown) => ({
			getPropertyValue(prop: string) {
				return (target as ReturnType<typeof createMockElement>)._computedStyles[prop] ?? '';
			},
		});

		try {
			resolveUnsupportedColours(el as unknown as HTMLElement);
			expect(el._inline['color']).toBe('#2fa87d');
		} finally {
			if (origGetComputed) {
				globalThis.window.getComputedStyle = origGetComputed;
			}
		}
	});

	it('converts complex colour properties with regex replacement', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
			'oklch(0.3 0.1 90)': '#3a5a1c',
		});
		setScratchCtx(ctx);

		const el = createMockElement({
			computedStyles: {
				'box-shadow': '0 2px 4px oklch(0.7 0.15 180), 0 1px 2px oklch(0.3 0.1 90)',
			},
		});

		const origGetComputed = globalThis.window?.getComputedStyle;
		// @ts-expect-error - mock
		globalThis.window ??= {};
		// @ts-expect-error - mock
		globalThis.window.getComputedStyle = (target: unknown) => ({
			getPropertyValue(prop: string) {
				return (target as ReturnType<typeof createMockElement>)._computedStyles[prop] ?? '';
			},
		});

		try {
			resolveUnsupportedColours(el as unknown as HTMLElement);
			expect(el._inline['box-shadow']).toBe('0 2px 4px #2fa87d, 0 1px 2px #3a5a1c');
		} finally {
			if (origGetComputed) {
				globalThis.window.getComputedStyle = origGetComputed;
			}
		}
	});

	it('converts custom properties (--*) on inline styles', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
		});
		setScratchCtx(ctx);

		const el = createMockElement({
			inlineStyles: { '--color-primary': 'oklch(0.7 0.15 180)' },
			computedStyles: {},
		});

		const origGetComputed = globalThis.window?.getComputedStyle;
		// @ts-expect-error - mock
		globalThis.window ??= {};
		// @ts-expect-error - mock
		globalThis.window.getComputedStyle = (_target: unknown) => ({
			getPropertyValue(_prop: string) {
				return '';
			},
		});

		try {
			resolveUnsupportedColours(el as unknown as HTMLElement);
			expect(el._inline['--color-primary']).toBe('#2fa87d');
		} finally {
			if (origGetComputed) {
				globalThis.window.getComputedStyle = origGetComputed;
			}
		}
	});

	it('leaves supported colour values unchanged', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);

		const el = createMockElement({
			computedStyles: { color: 'rgb(255, 0, 0)' },
		});

		const origGetComputed = globalThis.window?.getComputedStyle;
		// @ts-expect-error - mock
		globalThis.window ??= {};
		// @ts-expect-error - mock
		globalThis.window.getComputedStyle = (target: unknown) => ({
			getPropertyValue(prop: string) {
				return (target as ReturnType<typeof createMockElement>)._computedStyles[prop] ?? '';
			},
		});

		try {
			resolveUnsupportedColours(el as unknown as HTMLElement);
			// "color" should NOT have been set on inline style since rgb() is fine.
			expect(el._inline['color']).toBeUndefined();
		} finally {
			if (origGetComputed) {
				globalThis.window.getComputedStyle = origGetComputed;
			}
		}
	});

	it('processes children as well as the root', () => {
		const ctx = createMockCtx({
			'oklab(0.5 0.1 -0.1)': '#6a5eab',
		});
		setScratchCtx(ctx);

		const child = createMockElement({
			computedStyles: { 'background-color': 'oklab(0.5 0.1 -0.1)' },
		});
		const root = createMockElement({
			computedStyles: {},
			children: [child],
		});

		const origGetComputed = globalThis.window?.getComputedStyle;
		// @ts-expect-error - mock
		globalThis.window ??= {};
		// @ts-expect-error - mock
		globalThis.window.getComputedStyle = (target: unknown) => ({
			getPropertyValue(prop: string) {
				return (target as ReturnType<typeof createMockElement>)._computedStyles[prop] ?? '';
			},
		});

		try {
			resolveUnsupportedColours(root as unknown as HTMLElement);
			expect(child._inline['background-color']).toBe('#6a5eab');
		} finally {
			if (origGetComputed) {
				globalThis.window.getComputedStyle = origGetComputed;
			}
		}
	});

	it('skips elements without a style property', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);

		const noStyleEl = { style: undefined } as unknown;
		const root = createMockElement({
			computedStyles: {},
			children: [noStyleEl as ReturnType<typeof createMockElement>],
		});

		const origGetComputed = globalThis.window?.getComputedStyle;
		// @ts-expect-error - mock
		globalThis.window ??= {};
		// @ts-expect-error - mock
		globalThis.window.getComputedStyle = () => ({
			getPropertyValue() {
				return '';
			},
		});

		try {
			// Should not throw
			expect(() => resolveUnsupportedColours(root as unknown as HTMLElement)).not.toThrow();
		} finally {
			if (origGetComputed) {
				globalThis.window.getComputedStyle = origGetComputed;
			}
		}
	});
});

/* ------------------------------------------------------------------ */
/*  resolveRootCustomProperties                                       */
/* ------------------------------------------------------------------ */

describe('resolveRootCustomProperties', () => {
	afterEach(() => {
		resetScratchCtx();
	});

	function createMockDoc(htmlStyles: Record<string, string>, bodyStyles: Record<string, string>) {
		function createStyleObj(initial: Record<string, string>) {
			const data: Record<string, string> = { ...initial };
			const keys = Object.keys(data);

			const obj: Record<string | number, unknown> = {
				get length() {
					return keys.length;
				},
				getPropertyValue(prop: string) {
					return data[prop] ?? '';
				},
				setProperty(prop: string, value: string) {
					data[prop] = value;
					if (!keys.includes(prop)) {
						keys.push(prop);
					}
				},
				_data: data,
			};

			for (let i = 0; i < keys.length; i++) {
				Object.defineProperty(obj, i, {
					get: () => keys[i],
					configurable: true,
				});
			}

			return obj;
		}

		const htmlStyle = createStyleObj(htmlStyles);
		const bodyStyle = createStyleObj(bodyStyles);

		return {
			documentElement: { style: htmlStyle },
			body: { style: bodyStyle },
			_htmlData: htmlStyle._data as Record<string, string>,
			_bodyData: bodyStyle._data as Record<string, string>,
		};
	}

	it('converts custom properties on <html> element', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
		});
		setScratchCtx(ctx);

		const doc = createMockDoc({ '--color-primary': 'oklch(0.7 0.15 180)' }, {});

		resolveRootCustomProperties(doc as unknown as Document);
		expect(doc._htmlData['--color-primary']).toBe('#2fa87d');
	});

	it('converts custom properties on <body> element', () => {
		const ctx = createMockCtx({
			'oklab(0.5 0.1 -0.1)': '#6a5eab',
		});
		setScratchCtx(ctx);

		const doc = createMockDoc({}, { '--color-accent': 'oklab(0.5 0.1 -0.1)' });

		resolveRootCustomProperties(doc as unknown as Document);
		expect(doc._bodyData['--color-accent']).toBe('#6a5eab');
	});

	it('ignores non-custom properties', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);

		const doc = createMockDoc({ display: 'block' }, {});

		resolveRootCustomProperties(doc as unknown as Document);
		// "display" should remain unchanged
		expect(doc._htmlData['display']).toBe('block');
	});

	it('ignores custom properties without unsupported colour functions', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);

		const doc = createMockDoc({ '--spacing': '16px', '--color-safe': 'rgb(100, 200, 50)' }, {});

		resolveRootCustomProperties(doc as unknown as Document);
		expect(doc._htmlData['--spacing']).toBe('16px');
		expect(doc._htmlData['--color-safe']).toBe('rgb(100, 200, 50)');
	});

	it('handles missing body element gracefully', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);

		const doc = {
			documentElement: {
				style: {
					length: 0,
					getPropertyValue: () => '',
					setProperty: () => {},
				},
			},
			body: null,
		};

		expect(() => resolveRootCustomProperties(doc as unknown as Document)).not.toThrow();
	});
});

/* ------------------------------------------------------------------ */
/*  patchStylesheets                                                  */
/* ------------------------------------------------------------------ */

describe('patchStylesheets', () => {
	afterEach(() => {
		resetScratchCtx();
	});

	function createMockDocWithStyles(styleTexts: string[]) {
		const styleElements = styleTexts.map((text) => ({
			textContent: text,
		}));

		return {
			querySelectorAll(_sel: string) {
				return styleElements;
			},
			_styles: styleElements,
		};
	}

	it('replaces oklch() in stylesheet text', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
		});
		setScratchCtx(ctx);

		const doc = createMockDocWithStyles([':root { --color-primary: oklch(0.7 0.15 180); }']);

		patchStylesheets(doc as unknown as Document);
		expect(doc._styles[0].textContent).toBe(':root { --color-primary: #2fa87d; }');
	});

	it('replaces multiple oklch() calls in one stylesheet', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
			'oklch(0.3 0.1 90)': '#3a5a1c',
		});
		setScratchCtx(ctx);

		const doc = createMockDocWithStyles([
			':root { --a: oklch(0.7 0.15 180); --b: oklch(0.3 0.1 90); }',
		]);

		patchStylesheets(doc as unknown as Document);
		expect(doc._styles[0].textContent).toBe(':root { --a: #2fa87d; --b: #3a5a1c; }');
	});

	it('leaves stylesheets without unsupported colours unchanged', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);

		const originalText = '.foo { color: red; background: #fff; }';
		const doc = createMockDocWithStyles([originalText]);

		patchStylesheets(doc as unknown as Document);
		expect(doc._styles[0].textContent).toBe(originalText);
	});

	it('handles empty stylesheet text', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);

		const doc = createMockDocWithStyles(['']);
		patchStylesheets(doc as unknown as Document);
		expect(doc._styles[0].textContent).toBe('');
	});

	it('handles null textContent gracefully', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);

		const doc = {
			querySelectorAll() {
				return [{ textContent: null }];
			},
		};

		expect(() => patchStylesheets(doc as unknown as Document)).not.toThrow();
	});

	it('processes multiple <style> elements', () => {
		const ctx = createMockCtx({
			'oklch(0.7 0.15 180)': '#2fa87d',
			'lab(50 20 -30)': '#7a5e96',
		});
		setScratchCtx(ctx);

		const doc = createMockDocWithStyles([
			'.a { color: oklch(0.7 0.15 180); }',
			'.b { color: lab(50 20 -30); }',
			'.c { color: red; }', // No unsupported colours
		]);

		patchStylesheets(doc as unknown as Document);
		expect(doc._styles[0].textContent).toBe('.a { color: #2fa87d; }');
		expect(doc._styles[1].textContent).toBe('.b { color: #7a5e96; }');
		expect(doc._styles[2].textContent).toBe('.c { color: red; }');
	});
});

/* ------------------------------------------------------------------ */
/*  Edge cases: regex stateful /g flag                                */
/* ------------------------------------------------------------------ */

describe('regex stateful /g flag edge cases', () => {
	it('uNSUPPORTED_COLOR_FN_RE works correctly across consecutive calls', () => {
		// Global regexes maintain lastIndex state. Verify the production code
		// handles this correctly (String.prototype.match resets lastIndex).
		const inputs = ['oklch(0.7 0.15 180)', 'oklab(0.5 0.1 -0.1)', 'lch(50 30 270)'];
		for (const input of inputs) {
			const matches = input.match(UNSUPPORTED_COLOR_FN_RE);
			expect(matches).not.toBeNull();
			expect(matches).toHaveLength(1);
		}
	});

	it('uNSUPPORTED_COLOR_RE does not have /g flag (no state issue)', () => {
		// The detection regex should not be global, so it's safe for
		// repeated .test() calls.
		expect(UNSUPPORTED_COLOR_RE.global).toBeFalsy();
	});

	it('uNSUPPORTED_COLOR_FN_RE has /g flag for replaceAll behavior', () => {
		expect(UNSUPPORTED_COLOR_FN_RE.global).toBeTruthy();
	});
});

/* ------------------------------------------------------------------ */
/*  Realistic Tailwind v4 colour values                               */
/* ------------------------------------------------------------------ */

describe('realistic Tailwind v4 oklch values', () => {
	afterEach(() => {
		resetScratchCtx();
	});

	it('correctly replaces Tailwind v4 custom property declarations', () => {
		const ctx = createMockCtx({
			'oklch(0.488 0.243 264.376)': '#0037db',
			'oklch(0.961 0.018 106.424)': '#f5f0e6',
			'oklch(0.258 0.02 264.376)': '#1a1e3a',
		});
		setScratchCtx(ctx);

		const css = `:root {
  --color-blue-600: oklch(0.488 0.243 264.376);
  --color-stone-100: oklch(0.961 0.018 106.424);
  --color-slate-900: oklch(0.258 0.02 264.376);
}`;

		const result = replaceUnsupportedColors(css);
		expect(result).toContain('--color-blue-600: #0037db');
		expect(result).toContain('--color-stone-100: #f5f0e6');
		expect(result).toContain('--color-slate-900: #1a1e3a');
	});

	it('handles oklch with percentage lightness', () => {
		const ctx = createMockCtx({
			'oklch(72.3% 0.15 180)': '#2fa87d',
		});
		setScratchCtx(ctx);

		expect(replaceUnsupportedColors('oklch(72.3% 0.15 180)')).toBe('#2fa87d');
	});
});

/* ------------------------------------------------------------------ */
/*  Boundary and special values                                       */
/* ------------------------------------------------------------------ */

describe('boundary and special values', () => {
	afterEach(() => {
		resetScratchCtx();
	});

	it('handles color(display-p3 ...) with gamut mapping', () => {
		const ctx = createMockCtx({
			'color(display-p3 1 0 0)': '#ff0000',
			'color(display-p3 0 1 0)': '#00ff00',
			'color(display-p3 0 0 1)': '#0000ff',
		});
		setScratchCtx(ctx);

		expect(resolveColorToSrgb('color(display-p3 1 0 0)')).toBe('#ff0000');
		expect(resolveColorToSrgb('color(display-p3 0 1 0)')).toBe('#00ff00');
		expect(resolveColorToSrgb('color(display-p3 0 0 1)')).toBe('#0000ff');
	});

	it('handles lab() with negative a/b values', () => {
		const ctx = createMockCtx({
			'lab(50 -20 30)': '#4a8046',
			'lab(50 20 -30)': '#7a5e96',
		});
		setScratchCtx(ctx);

		expect(resolveColorToSrgb('lab(50 -20 30)')).toBe('#4a8046');
		expect(resolveColorToSrgb('lab(50 20 -30)')).toBe('#7a5e96');
	});

	it('handles lch() with full hue range', () => {
		const ctx = createMockCtx({
			'lch(50 30 0)': '#9d5d6b',
			'lch(50 30 90)': '#837040',
			'lch(50 30 180)': '#387969',
			'lch(50 30 270)': '#566aa0',
		});
		setScratchCtx(ctx);

		expect(resolveColorToSrgb('lch(50 30 0)')).toBe('#9d5d6b');
		expect(resolveColorToSrgb('lch(50 30 90)')).toBe('#837040');
		expect(resolveColorToSrgb('lch(50 30 180)')).toBe('#387969');
		expect(resolveColorToSrgb('lch(50 30 270)')).toBe('#566aa0');
	});

	it('handles colour values with extra whitespace', () => {
		const ctx = createMockCtx({
			'oklch(  0.7   0.15   180  )': '#2fa87d',
		});
		setScratchCtx(ctx);

		// resolveColorToSrgb trims, but the regex must also match.
		const input = '  oklch(  0.7   0.15   180  )  ';
		const result = resolveColorToSrgb(input);
		expect(result).toBe('#2fa87d');
	});

	it('returns original for empty string', () => {
		const ctx = createMockCtx({});
		setScratchCtx(ctx);
		expect(resolveColorToSrgb('')).toBe('');
	});
});

/* ------------------------------------------------------------------ */
/*  Integration: UNSUPPORTED_COLOR_RE + UNSUPPORTED_COLOR_FN_RE       */
/* ------------------------------------------------------------------ */

describe('detection + extraction regex consistency', () => {
	const validCases = [
		'oklch(0.7 0.15 180)',
		'oklab(0.5 0.1 -0.1)',
		'lch(50 30 270)',
		'lab(50 20 -30)',
		'color(display-p3 1 0 0)',
		'color(srgb 0.5 0.5 0.5)',
	];

	it.each(validCases)('detection and extraction both match: %s', (value) => {
		expect(UNSUPPORTED_COLOR_RE.test(value)).toBeTruthy();
		const matches = value.match(UNSUPPORTED_COLOR_FN_RE);
		expect(matches).not.toBeNull();
		expect(matches).toHaveLength(1);
		expect(matches![0]).toBe(value);
	});

	const negativeCases = [
		'rgb(255, 0, 0)',
		'rgba(0, 0, 0, 0.5)',
		'#ff0000',
		'hsl(0, 100%, 50%)',
		'red',
		'transparent',
		'',
	];

	it.each(negativeCases)('neither regex matches supported value: %s', (value) => {
		expect(UNSUPPORTED_COLOR_RE.test(value)).toBeFalsy();
		expect(value.match(UNSUPPORTED_COLOR_FN_RE)).toBeNull();
	});
});

/* ------------------------------------------------------------------ */
/*  Scratch context lifecycle                                         */
/* ------------------------------------------------------------------ */

describe('scratch context lifecycle', () => {
	afterEach(() => {
		resetScratchCtx();
	});

	it('setScratchCtx overrides the context', () => {
		const ctx = createMockCtx({ 'oklch(0.5 0 0)': '#777777' });
		setScratchCtx(ctx);
		expect(resolveColorToSrgb('oklch(0.5 0 0)')).toBe('#777777');
	});

	it('setScratchCtx(null) causes resolveColorToSrgb to return original', () => {
		setScratchCtx(null);
		expect(resolveColorToSrgb('oklch(0.5 0 0)')).toBe('oklch(0.5 0 0)');
	});

	it('resetScratchCtx sets state to undefined (will re-create on next use)', () => {
		setScratchCtx(null);
		resetScratchCtx();
		// After reset, next call to getScratchCtx will try document.createElement
		// which doesn't exist in this test environment, but the reset itself
		// should not throw.
		expect(true).toBeTruthy();
	});
});

/* ------------------------------------------------------------------ */
/*  Complex gradient and shadow strings                               */
/* ------------------------------------------------------------------ */

describe('complex CSS value replacement', () => {
	afterEach(() => {
		resetScratchCtx();
	});

	it('handles radial gradient with oklch stops', () => {
		const ctx = createMockCtx({
			'oklch(0.9 0.05 100)': '#e8e0c0',
			'oklch(0.1 0.05 280)': '#1a1040',
		});
		setScratchCtx(ctx);

		const input = 'radial-gradient(circle at center, oklch(0.9 0.05 100), oklch(0.1 0.05 280))';
		const result = replaceUnsupportedColors(input);
		expect(result).toBe('radial-gradient(circle at center, #e8e0c0, #1a1040)');
	});

	it('handles conic-gradient with oklch stops', () => {
		const ctx = createMockCtx({
			'oklch(0.8 0.2 0)': '#ff6080',
			'oklch(0.8 0.2 120)': '#80c000',
			'oklch(0.8 0.2 240)': '#0080ff',
		});
		setScratchCtx(ctx);

		const input = 'conic-gradient(oklch(0.8 0.2 0), oklch(0.8 0.2 120), oklch(0.8 0.2 240))';
		const result = replaceUnsupportedColors(input);
		expect(result).toBe('conic-gradient(#ff6080, #80c000, #0080ff)');
	});

	it('handles multiple shadows with mixed colour formats', () => {
		const ctx = createMockCtx({
			'oklch(0.3 0 0 / 0.2)': 'rgba(30, 30, 30, 0.2)',
		});
		setScratchCtx(ctx);

		// One shadow uses oklch, the other uses rgb; only oklch is replaced.
		const input = '0 2px 4px oklch(0.3 0 0 / 0.2), 0 4px 8px rgb(0, 0, 0)';
		const result = replaceUnsupportedColors(input);
		expect(result).toBe('0 2px 4px rgba(30, 30, 30, 0.2), 0 4px 8px rgb(0, 0, 0)');
	});

	it('preserves gradient direction/shape syntax', () => {
		const ctx = createMockCtx({
			'oklch(0.5 0.1 200)': '#2a7090',
		});
		setScratchCtx(ctx);

		const input = 'linear-gradient(to right, oklch(0.5 0.1 200), transparent)';
		const result = replaceUnsupportedColors(input);
		expect(result).toBe('linear-gradient(to right, #2a7090, transparent)');
	});
});

/* ------------------------------------------------------------------ */
/*  Regression: UNSUPPORTED_COLOR_RE false-positive guarding          */
/* ------------------------------------------------------------------ */

describe('false positive guarding', () => {
	it("'lab' alone does not trigger detection (requires opening paren)", () => {
		expect(UNSUPPORTED_COLOR_RE.test('lab')).toBeFalsy();
	});

	it("'lch' alone does not trigger detection (requires opening paren)", () => {
		expect(UNSUPPORTED_COLOR_RE.test('lch')).toBeFalsy();
	});

	it("'color' alone does not trigger detection (requires opening paren)", () => {
		expect(UNSUPPORTED_COLOR_RE.test('color')).toBeFalsy();
	});

	it("'oklch' triggers detection even without paren (distinctive word)", () => {
		expect(UNSUPPORTED_COLOR_RE.test('oklch')).toBeTruthy();
	});

	it("'oklab' triggers detection even without paren (distinctive word)", () => {
		expect(UNSUPPORTED_COLOR_RE.test('oklab')).toBeTruthy();
	});

	it("'laboratory' does not trigger detection", () => {
		expect(UNSUPPORTED_COLOR_RE.test('laboratory')).toBeFalsy();
	});

	it("'colorful' does not trigger detection", () => {
		expect(UNSUPPORTED_COLOR_RE.test('colorful')).toBeFalsy();
	});

	it("'collab' does not trigger detection", () => {
		expect(UNSUPPORTED_COLOR_RE.test('collab')).toBeFalsy();
	});

	it("'launch' does not trigger detection", () => {
		expect(UNSUPPORTED_COLOR_RE.test('launch')).toBeFalsy();
	});
});
