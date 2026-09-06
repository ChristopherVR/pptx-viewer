import { themeColorRefFromSchemeClr } from '../color/theme-color-ref';
/**
 * Extended animation parsing helpers for OOXML animation node types:
 * p:animClr, p:excl, p:cmd, p:iterate, and text-level targets (p:txEl).
 */
import type {
	PptxColorAnimation,
	PptxTextAnimationTarget,
	PptxAnimationIterate,
	PptxThemeColorRef,
	XmlObject,
} from '../types';
import { extractAttrNameFromCBhvr } from './native-animation-attr-name';
import { ensureArray } from './native-animation-helpers';

/**
 * Parse `p:animClr` nodes from the child timing list.
 * Returns color animation data including color space, direction, and colors.
 */
export function extractColorAnimation(
	childTnList: XmlObject | undefined,
): PptxColorAnimation | undefined {
	if (!childTnList) {
		return undefined;
	}

	const animClrNodes = ensureArray(childTnList['p:animClr']);
	if (animClrNodes.length === 0) {
		return undefined;
	}
	const components = animClrNodes.map(extractSingleColorAnimation);
	const primary = components[0];
	return components.length > 1 ? { ...primary, components } : primary;
}

/** Parse one `p:animClr` behaviour while keeping the public aggregate flat. */
function extractSingleColorAnimation(node: XmlObject): PptxColorAnimation {
	const clrSpc = String(node['@_clrSpc'] || 'rgb').toLowerCase();
	const colorSpace: 'hsl' | 'rgb' = clrSpc === 'hsl' ? 'hsl' : 'rgb';
	const dir = String(node['@_dir'] || '').toLowerCase();
	const direction = dir === 'cw' ? 'cw' : dir === 'ccw' ? 'ccw' : undefined;
	// ECMA-376 §19.5.13 also defines `@path` as a companion HSL-direction
	// hint. Preserve verbatim for round-trip — we don't attempt to interpret
	// the value here, only ensure it survives a parse/save cycle.
	const path = node['@_path'] !== undefined ? String(node['@_path']) : undefined;

	const fromContainer = node['p:from'] as XmlObject | undefined;
	const toContainer = node['p:to'] as XmlObject | undefined;
	const byContainer = node['p:by'] as XmlObject | undefined;
	const fromColor = extractColorValue(fromContainer);
	const toColor = extractColorValue(toContainer);
	const byColor = extractHslDeltaOrColorValue(byContainer, colorSpace);
	const hslDelta = colorSpace === 'hsl' ? extractHslDelta(byContainer) : undefined;
	const fromColorRef = extractSchemeColorRef(fromContainer);
	const toColorRef = extractSchemeColorRef(toContainer);
	// An HSL `by` is a signed delta (see `hslDelta`), never a theme colour.
	const byColorRef = colorSpace === 'hsl' ? undefined : extractSchemeColorRef(byContainer);

	// Extract target attribute from p:cBhvr/p:attrNameLst/p:attrName.
	const targetAttribute = extractAttrNameFromCBhvr(node['p:cBhvr'] as XmlObject | undefined);

	const result: PptxColorAnimation = {
		colorSpace,
		direction,
		path,
		fromColor,
		toColor,
		byColor,
		hslDelta,
		targetAttribute,
	};
	if (fromColorRef) {
		result.fromColorRef = fromColorRef;
	}
	if (toColorRef) {
		result.toColorRef = toColorRef;
	}
	if (byColorRef) {
		result.byColorRef = byColorRef;
	}
	return result;
}

/** The typed theme reference for a colour container's `a:schemeClr` child, when present. */
function extractSchemeColorRef(
	colorContainer: XmlObject | undefined,
): PptxThemeColorRef | undefined {
	return themeColorRefFromSchemeClr(colorContainer?.['a:schemeClr'] as XmlObject | undefined);
}

/** Decode OOXML's signed HSL offsets into degrees / percentage points. */
function extractHslDelta(colorContainer: XmlObject | undefined): PptxColorAnimation['hslDelta'] {
	const hsl = colorContainer?.['p:hsl'] as XmlObject | undefined;
	if (!hsl) {
		return undefined;
	}
	return {
		hue: Number(hsl['@_h'] ?? 0) / 60000,
		saturation: Number(hsl['@_s'] ?? 0) / 1000,
		lightness: Number(hsl['@_l'] ?? 0) / 1000,
	};
}

/**
 * Extract a `p:by` colour container, retaining the historical HSL delta-hex
 * compatibility value (`#HHSSLL`, each channel's low byte). The structured
 * `hslDelta` parsed alongside it is authoritative because it preserves signs
 * and values outside one byte. RGB animations behave like
 * {@link extractColorValue}.
 */
function extractHslDeltaOrColorValue(
	colorContainer: XmlObject | undefined,
	colorSpace: 'hsl' | 'rgb',
): string | undefined {
	if (!colorContainer) {
		return undefined;
	}

	if (colorSpace === 'hsl') {
		// CT_TLByHslColorTransform: hue (60000ths/degree), sat/lum (1000ths/percent)
		const hsl = colorContainer['p:hsl'] as XmlObject | undefined;
		if (hsl) {
			const hueRaw = Number(hsl['@_h'] ?? 0);
			const satRaw = Number(hsl['@_s'] ?? 0);
			const lumRaw = Number(hsl['@_l'] ?? 0);
			const hueByte = packSignedDeltaByte(Math.round(hueRaw / 60000));
			const satByte = packSignedDeltaByte(Math.round(satRaw / 1000));
			const lumByte = packSignedDeltaByte(Math.round(lumRaw / 1000));
			return `#${hueByte}${satByte}${lumByte}`;
		}
	}

	return extractColorValue(colorContainer);
}

/** Pack a signed integer into a two-digit two's-complement byte hex. */
function packSignedDeltaByte(n: number): string {
	const v = ((n % 256) + 256) % 256;
	return v.toString(16).padStart(2, '0').toUpperCase();
}

/**
 * Extract a hex color string from a color container node.
 * Handles `a:srgbClr/@val`, `a:schemeClr/@val`, and `a:hslClr`.
 */
function extractColorValue(colorContainer: XmlObject | undefined): string | undefined {
	if (!colorContainer) {
		return undefined;
	}

	const srgb = colorContainer['a:srgbClr'] as XmlObject | undefined;
	if (srgb?.['@_val']) {
		return `#${String(srgb['@_val'])}`;
	}

	const scheme = colorContainer['a:schemeClr'] as XmlObject | undefined;
	if (scheme?.['@_val']) {
		return String(scheme['@_val']);
	}

	// HSL colour: hue in 60000ths of a degree, sat/lum in 1000ths of a percent
	const hslNode = colorContainer['a:hslClr'] as XmlObject | undefined;
	if (hslNode) {
		const hueRaw = Number(hslNode['@_hue'] ?? 0);
		const satRaw = Number(hslNode['@_sat'] ?? 0);
		const lumRaw = Number(hslNode['@_lum'] ?? 0);
		// Convert OOXML units: hue is in 60000ths of a degree, sat/lum in 1000ths of percent
		const hue = hueRaw / 60000; // degrees 0-360
		const sat = satRaw / 1000; // percent 0-100
		const lum = lumRaw / 1000; // percent 0-100
		const rgb = hslToRgbSimple(hue, sat, lum);
		return `#${toHex2(rgb.r)}${toHex2(rgb.g)}${toHex2(rgb.b)}`;
	}

	return undefined;
}

/** Convert HSL (h: 0-360, s: 0-100, l: 0-100) to RGB (0-255). */
function hslToRgbSimple(h: number, s: number, l: number): { r: number; g: number; b: number } {
	const sn = s / 100;
	const ln = l / 100;

	if (sn === 0) {
		const v = Math.round(ln * 255);
		return { r: v, g: v, b: v };
	}

	const hueToRgb = (p: number, q: number, t: number): number => {
		let tn = t;
		if (tn < 0) {
			tn += 1;
		}
		if (tn > 1) {
			tn -= 1;
		}
		if (tn < 1 / 6) {
			return p + (q - p) * 6 * tn;
		}
		if (tn < 1 / 2) {
			return q;
		}
		if (tn < 2 / 3) {
			return p + (q - p) * (2 / 3 - tn) * 6;
		}
		return p;
	};

	const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
	const p = 2 * ln - q;
	const hn = h / 360;

	return {
		r: Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
		g: Math.round(hueToRgb(p, q, hn) * 255),
		b: Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
	};
}

/** Format a number (0-255) as a two-digit hex string. */
function toHex2(n: number): string {
	return Math.max(0, Math.min(255, Math.round(n)))
		.toString(16)
		.padStart(2, '0');
}

/**
 * Parse `p:txEl` (text-level animation target) from a `p:spTgt` node.
 * Returns character range or paragraph range for text build animations.
 */
export function extractTextTarget(
	spTgt: XmlObject | undefined,
): PptxTextAnimationTarget | undefined {
	if (!spTgt) {
		return undefined;
	}

	const txEl = spTgt['p:txEl'] as XmlObject | undefined;
	if (!txEl) {
		return undefined;
	}

	const charRg = txEl['p:charRg'] as XmlObject | undefined;
	if (charRg) {
		const st = Number.parseInt(String(charRg['@_st'] ?? '0'), 10);
		const end = Number.parseInt(String(charRg['@_end'] ?? '0'), 10);
		return { type: 'charRg', start: st, end };
	}

	const pRg = txEl['p:pRg'] as XmlObject | undefined;
	if (pRg) {
		const st = Number.parseInt(String(pRg['@_st'] ?? '0'), 10);
		const end = Number.parseInt(String(pRg['@_end'] ?? '0'), 10);
		return { type: 'pRg', start: st, end };
	}

	return undefined;
}

/**
 * Parse `p:iterate` from a `p:cTn` node.
 * Returns iteration config (type, backwards, timing).
 */
export function extractIterate(cTn: XmlObject | undefined): PptxAnimationIterate | undefined {
	if (!cTn) {
		return undefined;
	}

	const iterate = cTn['p:iterate'] as XmlObject | undefined;
	if (!iterate) {
		return undefined;
	}

	const rawType = String(iterate['@_type'] || 'el').toLowerCase();
	const type: 'el' | 'lt' | 'wd' = rawType === 'lt' ? 'lt' : rawType === 'wd' ? 'wd' : 'el';

	const backwards = iterate['@_backwards'] === '1' ? true : undefined;

	const tmPctNode = iterate['p:tmPct'] as XmlObject | undefined;
	const tmAbsNode = iterate['p:tmAbs'] as XmlObject | undefined;

	let tmPct: number | undefined;
	let tmAbs: number | undefined;

	if (tmPctNode?.['@_val'] !== undefined) {
		tmPct = Number.parseInt(String(tmPctNode['@_val']), 10);
	}
	if (tmAbsNode?.['@_val'] !== undefined) {
		tmAbs = Number.parseInt(String(tmAbsNode['@_val']), 10);
	}

	return { type, backwards, tmPct, tmAbs };
}

/**
 * Parse `p:cmd` (command node) from a child timing list.
 * Returns command type (call/evt/verb) and command string.
 */
export function extractCommand(childTnList: XmlObject | undefined): {
	commandType?: string;
	commandString?: string;
} {
	if (!childTnList) {
		return {};
	}

	const cmdNodes = ensureArray(childTnList['p:cmd']);
	if (cmdNodes.length === 0) {
		return {};
	}

	const cmd = cmdNodes[0];
	const commandType = cmd['@_type'] ? String(cmd['@_type']) : undefined;
	const commandString = cmd['@_cmd'] ? String(cmd['@_cmd']) : undefined;

	return { commandType, commandString };
}

/**
 * Check whether a node is inside an exclusive container (`p:excl`).
 * Returns true if the parent context indicates exclusivity.
 */
export function isExclusiveNode(childTnList: XmlObject | undefined): boolean {
	if (!childTnList) {
		return false;
	}
	return ensureArray(childTnList['p:excl']).length > 0;
}

export {
	extractGraphicBuilds,
	extractOleChartBuilds,
	extractSmartArtBuilds,
} from './animation-target-build-helpers';

/**
 * Parse a timing attribute that may legitimately be absent or `"indefinite"`.
 * Returns `undefined` for anything that is not a finite millisecond count.
 */
export function readTimingAttr(raw: unknown): number | undefined {
	if (raw === undefined || raw === null) {
		return undefined;
	}
	const text = String(raw).trim();
	if (text.length === 0 || text === 'indefinite') {
		return undefined;
	}
	const parsed = Number.parseInt(text, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The effect's start delay, taken from `p:stCondLst/p:cond/@delay`.
 *
 * PowerPoint writes an effect's delay as a start CONDITION, not as `@delay` on
 * the effect's `p:cTn`. The list also carries non-numeric conditions - notably
 * `delay="indefinite"`, which means "wait for a click" rather than a duration -
 * so those are skipped and the smallest real delay wins (the effect starts at
 * the first condition that can fire).
 */
export function extractStartConditionDelayMs(cTn: XmlObject): number | undefined {
	const stCondLst = cTn['p:stCondLst'] as XmlObject | undefined;
	if (!stCondLst) {
		return undefined;
	}
	let smallest: number | undefined;
	for (const condition of ensureArray(stCondLst['p:cond'])) {
		const delay = readTimingAttr((condition as XmlObject)['@_delay']);
		if (delay !== undefined && delay > 0 && (smallest === undefined || delay < smallest)) {
			smallest = delay;
		}
	}
	return smallest;
}

/** Behaviour elements whose `p:cBhvr/p:cTn/@dur` gives an effect its duration. */
const BEHAVIOUR_TAGS = [
	'p:animEffect',
	'p:anim',
	'p:animClr',
	'p:animMotion',
	'p:animRot',
	'p:animScale',
	'p:set',
] as const;

/**
 * The effect's duration, taken from its child behaviour's `p:cBhvr/p:cTn/@dur`.
 *
 * An effect `p:cTn` is a container: the real duration sits on the behaviour it
 * wraps. `p:set` is skipped when a longer behaviour exists because PowerPoint
 * emits it as a 1ms visibility flip that would otherwise mask the real timing.
 */
export function extractChildBehaviourDurationMs(
	cTn: XmlObject,
	toArray: (value: unknown) => XmlObject[],
): number | undefined {
	const childTnLst = cTn['p:childTnLst'] as XmlObject | undefined;
	if (!childTnLst) {
		return undefined;
	}
	let longest: number | undefined;
	for (const tag of BEHAVIOUR_TAGS) {
		for (const behaviour of toArray(childTnLst[tag])) {
			const bhvr = behaviour['p:cBhvr'] as XmlObject | undefined;
			const inner = bhvr?.['p:cTn'] as XmlObject | undefined;
			const dur = readTimingAttr(inner?.['@_dur']);
			if (dur !== undefined && dur > 1 && (longest === undefined || dur > longest)) {
				longest = dur;
			}
		}
	}
	return longest;
}
