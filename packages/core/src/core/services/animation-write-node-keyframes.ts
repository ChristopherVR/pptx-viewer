/**
 * Keyframe (`p:tav` / `p:tavLst`) serialization for the OOXML animation
 * write service. Extracted from `animation-write-node-builders` to keep
 * file sizes manageable.
 */
import type { PptxAnimationKeyframe, XmlObject } from '../types';

/** Default opacity-emphasis keyframes used when no parsed keyframes exist. */
export const DEFAULT_OPACITY_KEYFRAMES: ReadonlyArray<PptxAnimationKeyframe> = [
	{ tm: 0, value: '1', valueType: 'str' },
	{ tm: 50000, value: '0.4', valueType: 'str' },
	{ tm: 100000, value: '1', valueType: 'str' },
];

/**
 * Serialize an array of {@link PptxAnimationKeyframe} entries into an
 * OOXML `p:tavLst` XML object.
 *
 * @see ECMA-376 §19.5.30 CT_TLAnimVariantList
 */
export function buildTavLstFromKeyframes(
	keyframes: ReadonlyArray<PptxAnimationKeyframe> | undefined,
): XmlObject | undefined {
	if (!keyframes || keyframes.length === 0) {
		return undefined;
	}

	const tavNodes: XmlObject[] = keyframes.map((kf) => {
		const node: XmlObject = {
			'@_tm': typeof kf.tm === 'number' ? String(kf.tm) : kf.tm,
		};
		if (kf.fmla !== undefined) {
			node['@_fmla'] = kf.fmla;
		}
		node['p:val'] = encodeKeyframeValue(kf);
		return node;
	});

	return {
		'p:tav': tavNodes.length === 1 ? tavNodes[0] : tavNodes,
	} as XmlObject;
}

function encodeKeyframeValue(kf: PptxAnimationKeyframe): XmlObject {
	switch (kf.valueType) {
		case 'bool':
			return { 'p:boolVal': { '@_val': kf.value === true || kf.value === 'true' ? '1' : '0' } };
		case 'int': {
			const n =
				typeof kf.value === 'number' ? Math.trunc(kf.value) : Number.parseInt(String(kf.value), 10);
			return { 'p:intVal': { '@_val': String(Number.isNaN(n) ? 0 : n) } };
		}
		case 'flt': {
			const n = typeof kf.value === 'number' ? kf.value : Number.parseFloat(String(kf.value));
			return { 'p:fltVal': { '@_val': String(Number.isNaN(n) ? 0 : n) } };
		}
		case 'clr': {
			// Stored either as a hex string (#RRGGBB) or scheme token. Round-trip
			// hex strings into a:srgbClr; otherwise emit @_val for non-hex tokens.
			const v = String(kf.value);
			if (v.startsWith('#') && v.length === 7) {
				return { 'p:clrVal': { 'a:srgbClr': { '@_val': v.slice(1).toUpperCase() } } };
			}
			return { 'p:clrVal': { '@_val': v } };
		}
		case 'str':
		default:
			return { 'p:strVal': { '@_val': String(kf.value) } };
	}
}
