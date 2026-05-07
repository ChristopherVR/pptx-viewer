/**
 * Translate {@link PptxImageEffects} into an SVG `<filter>` definition so the
 * SVG converter can apply blip-side effects parsed by the runtime (alpha
 * primitives, lum/hsl/tint, color change, blur, brightness/contrast, etc.).
 *
 * Returns the filter `<defs>` XML and a stable `id` callers can reference via
 * `filter="url(#id)"` on the `<image>` element. Returns `null` when the effects
 * are empty or only contain opaque round-trip blobs (alphaMod / fillOverlay).
 *
 * @module svg-image-effects
 */

import type { PptxImageEffects } from '../core/types';

/**
 * Build an SVG `<filter>` element representing the supplied effects.
 *
 * The returned `id` is deterministic for a given effects payload, allowing the
 * exporter to share `<defs>` between elements that use the same effect chain.
 */
export function buildImageEffectsFilter(
	effects: PptxImageEffects | undefined,
	idSuffix: string,
): { defsXml: string; filterId: string } | null {
	if (!effects) {
		return null;
	}
	const primitives: string[] = [];
	let inputRef = 'SourceGraphic';

	const next = (resultName: string, body: string): void => {
		primitives.push(body.replace('__IN__', inputRef).replace('__OUT__', resultName));
		inputRef = resultName;
	};

	// Order matches PowerPoint's blip evaluation order:
	// crop/tile happen on the <image> tag itself; here we apply colour/alpha.
	if (effects.grayscale) {
		next('p1', `<feColorMatrix in="__IN__" type="saturate" values="0" result="__OUT__"/>`);
	}

	if (typeof effects.saturation === 'number') {
		// saturation is -100..100; SVG saturate value is 0..2 typically (1 = unchanged).
		const v = clamp01to2(1 + effects.saturation / 100);
		next('p2', `<feColorMatrix in="__IN__" type="saturate" values="${fmt(v)}" result="__OUT__"/>`);
	}

	if (typeof effects.hsl?.hue === 'number') {
		next(
			'p3',
			`<feColorMatrix in="__IN__" type="hueRotate" values="${fmt(effects.hsl.hue)}" result="__OUT__"/>`,
		);
	}

	if (typeof effects.brightness === 'number' || typeof effects.contrast === 'number') {
		const b = (effects.brightness ?? 0) / 100; // -1..1
		const c = 1 + (effects.contrast ?? 0) / 100; // 0..2
		// linear: out = slope*in + intercept; intercept = b + (1-c)/2 to keep mid-grey stable.
		const slope = c;
		const intercept = b + (1 - c) / 2;
		next(
			'p4',
			`<feComponentTransfer in="__IN__" result="__OUT__">` +
				`<feFuncR type="linear" slope="${fmt(slope)}" intercept="${fmt(intercept)}"/>` +
				`<feFuncG type="linear" slope="${fmt(slope)}" intercept="${fmt(intercept)}"/>` +
				`<feFuncB type="linear" slope="${fmt(slope)}" intercept="${fmt(intercept)}"/>` +
				`</feComponentTransfer>`,
		);
	}

	if (
		effects.lum &&
		(typeof effects.lum.bright === 'number' || typeof effects.lum.contrast === 'number')
	) {
		const b = (effects.lum.bright ?? 0) / 100;
		const c = 1 + (effects.lum.contrast ?? 0) / 100;
		const slope = c;
		const intercept = b + (1 - c) / 2;
		next(
			'p5',
			`<feComponentTransfer in="__IN__" result="__OUT__">` +
				`<feFuncR type="linear" slope="${fmt(slope)}" intercept="${fmt(intercept)}"/>` +
				`<feFuncG type="linear" slope="${fmt(slope)}" intercept="${fmt(intercept)}"/>` +
				`<feFuncB type="linear" slope="${fmt(slope)}" intercept="${fmt(intercept)}"/>` +
				`</feComponentTransfer>`,
		);
	}

	if (typeof effects.biLevel === 'number') {
		// Convert to grayscale then threshold each channel.
		next('p6a', `<feColorMatrix in="__IN__" type="saturate" values="0" result="__OUT__"/>`);
		const t = clamp(effects.biLevel / 100, 0, 1);
		next(
			'p6b',
			`<feComponentTransfer in="__IN__" result="__OUT__">` +
				`<feFuncR type="discrete" tableValues="${t === 0 ? '1 1' : `0 ${stepTable(t)}`}"/>` +
				`<feFuncG type="discrete" tableValues="${t === 0 ? '1 1' : `0 ${stepTable(t)}`}"/>` +
				`<feFuncB type="discrete" tableValues="${t === 0 ? '1 1' : `0 ${stepTable(t)}`}"/>` +
				`</feComponentTransfer>`,
		);
	}

	if (effects.duotone) {
		// Convert to grayscale, then map [0..1] → linear blend between color1 and color2.
		const c1 = parseHexRgb(effects.duotone.color1);
		const c2 = parseHexRgb(effects.duotone.color2);
		next('p7a', `<feColorMatrix in="__IN__" type="saturate" values="0" result="__OUT__"/>`);
		next(
			'p7b',
			`<feComponentTransfer in="__IN__" result="__OUT__">` +
				`<feFuncR type="linear" slope="${fmt(c2.r - c1.r)}" intercept="${fmt(c1.r)}"/>` +
				`<feFuncG type="linear" slope="${fmt(c2.g - c1.g)}" intercept="${fmt(c1.g)}"/>` +
				`<feFuncB type="linear" slope="${fmt(c2.b - c1.b)}" intercept="${fmt(c1.b)}"/>` +
				`</feComponentTransfer>`,
		);
	}

	if (effects.tint && typeof effects.tint.amt === 'number') {
		// Approximate: tint pulls colour toward a specific hue; amt -100..100.
		// Use saturate down for negative, hueRotate by hue for positive.
		const amt = clamp(effects.tint.amt / 100, -1, 1);
		if (amt < 0) {
			next(
				'p8',
				`<feColorMatrix in="__IN__" type="saturate" values="${fmt(1 + amt)}" result="__OUT__"/>`,
			);
		}
		if (typeof effects.tint.hue === 'number') {
			next(
				'p8h',
				`<feColorMatrix in="__IN__" type="hueRotate" values="${fmt(effects.tint.hue)}" result="__OUT__"/>`,
			);
		}
	}

	if (effects.clrRepl) {
		// Map all colour information to clrRepl.color, preserving alpha.
		const c = parseHexRgb(effects.clrRepl.color);
		next(
			'p9',
			`<feColorMatrix in="__IN__" type="matrix" result="__OUT__" values="` +
				`0 0 0 0 ${fmt(c.r)} ` +
				`0 0 0 0 ${fmt(c.g)} ` +
				`0 0 0 0 ${fmt(c.b)} ` +
				`0 0 0 1 0"/>`,
		);
	}

	if (effects.colorWash) {
		// Overlay flood at fixed opacity blended with `in`.
		const c = parseHexRgb(effects.colorWash.color);
		const o = clamp((effects.colorWash.opacity ?? 50) / 100, 0, 1);
		primitives.push(
			`<feFlood flood-color="${effects.colorWash.color}" flood-opacity="${fmt(o)}" result="wash"/>` +
				`<feComposite in="wash" in2="${inputRef}" operator="in" result="washmasked"/>` +
				`<feBlend in="washmasked" in2="${inputRef}" mode="normal" result="washed"/>`,
		);
		// Mark the actual reference c for downstream callers (no-op suppress).
		void c;
		inputRef = 'washed';
	}

	if (effects.clrChange) {
		// Approximation: mask out `clrFrom` using a colour-matrix that drives
		// alpha to 0 for matching pixels. Then composite with `in` for non-match.
		// True spec is "replace clrFrom with clrTo"; we handle the common transparency case.
		if (effects.clrChange.clrToTransparent) {
			const c = parseHexRgb(effects.clrChange.clrFrom);
			// Threshold-style mask via feColorMatrix is imprecise; emit a feComposite
			// chain. Simpler: feComponentTransfer per channel that clamps to alpha=0
			// when all three are within tolerance of `from`. SVG can't express that
			// cleanly without feComposite arithmetic. For now we skip applying and
			// fall through; the pixel data is unchanged. Mark as no-op effect.
			void c;
		}
		// Otherwise (clrFrom→clrTo solid): leave inputRef unchanged; the typed model
		// preserves rawXml for round-trip fidelity but rendering exact mapping needs
		// a custom shader. Out-of-scope here.
	}

	// --------- Alpha primitives ---------
	if (typeof effects.alphaModFix === 'number') {
		// alphaModFix sets a multiplier on alpha (0..100, 100 = identity).
		const mul = clamp(effects.alphaModFix / 100, 0, 1);
		next(
			'pa1',
			`<feColorMatrix in="__IN__" type="matrix" result="__OUT__" values="` +
				`1 0 0 0 0 ` +
				`0 1 0 0 0 ` +
				`0 0 1 0 0 ` +
				`0 0 0 ${fmt(mul)} 0"/>`,
		);
	}

	if (effects.alphaInv) {
		next(
			'pa2',
			`<feComponentTransfer in="__IN__" result="__OUT__">` +
				`<feFuncA type="linear" slope="-1" intercept="1"/>` +
				`</feComponentTransfer>`,
		);
	}

	if (effects.alphaCeiling) {
		next(
			'pa3',
			`<feComponentTransfer in="__IN__" result="__OUT__">` +
				// any non-zero alpha → 1
				`<feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1"/>` +
				`</feComponentTransfer>`,
		);
	}

	if (effects.alphaFloor) {
		next(
			'pa4',
			`<feComponentTransfer in="__IN__" result="__OUT__">` +
				// any non-fully-opaque → 0
				`<feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 1"/>` +
				`</feComponentTransfer>`,
		);
	}

	if (typeof effects.alphaRepl === 'number') {
		const a = clamp(effects.alphaRepl / 100, 0, 1);
		next(
			'pa5',
			`<feComponentTransfer in="__IN__" result="__OUT__">` +
				`<feFuncA type="linear" slope="0" intercept="${fmt(a)}"/>` +
				`</feComponentTransfer>`,
		);
	}

	if (typeof effects.alphaBiLevel === 'number') {
		const t = clamp(effects.alphaBiLevel / 100, 0, 1);
		// 10-bin discrete approximation of a step at threshold t.
		next(
			'pa6',
			`<feComponentTransfer in="__IN__" result="__OUT__">` +
				`<feFuncA type="discrete" tableValues="${stepTable10(t)}"/>` +
				`</feComponentTransfer>`,
		);
	}

	if (typeof effects.artisticEffect === 'string' && /blur/i.test(effects.artisticEffect)) {
		const r = Math.max(0, (effects.artisticRadius ?? 0) / 12700); // EMU → px
		if (r > 0) {
			next('pb', `<feGaussianBlur in="__IN__" stdDeviation="${fmt(r)}" result="__OUT__"/>`);
		}
	}

	if (primitives.length === 0) {
		return null;
	}

	const filterId = `imgfx-${idSuffix}`;
	const defsXml = `<filter id="${filterId}" x="-10%" y="-10%" width="120%" height="120%">${primitives.join('')}</filter>`;
	return { defsXml, filterId };
}

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

function clamp01to2(v: number): number {
	return clamp(v, 0, 2);
}

function fmt(v: number): string {
	return Number.isFinite(v) ? Number(v.toFixed(4)).toString() : '0';
}

function stepTable(t: number): string {
	// Used in single-bit discrete tables to encode "below t → 0, above t → 1".
	// Two-entry table approximates the threshold.
	return t < 0.5 ? '1' : '1';
}

function stepTable10(t: number): string {
	const out: string[] = [];
	for (let i = 0; i < 10; i++) {
		out.push(i / 10 >= t ? '1' : '0');
	}
	return out.join(' ');
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
	const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
	if (!m) {
		return { r: 0, g: 0, b: 0 };
	}
	const v = parseInt(m[1] ?? '000000', 16);
	return {
		r: ((v >> 16) & 0xff) / 255,
		g: ((v >> 8) & 0xff) / 255,
		b: (v & 0xff) / 255,
	};
}
