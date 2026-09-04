/**
 * Parse `p:cBhvr/@_additive`, `@_accumulate`, `@_xfrmType`, `@_override`
 * (ECMA-376 S19.5.4 CT_TLCommonBehaviorData) and `p:anim/@_calcmode`
 * (ECMA-376 S19.5.2 CT_TLAnimateBehavior), the generic behaviour-timing
 * attributes that change how a behaviour composites with siblings and how
 * its keyframes interpolate.
 *
 * @module services/native-animation-cbhvr-attrs
 */
import type { PptxNativeAnimation, XmlObject } from '../types';
import { ensureArray } from './native-animation-helpers';

type CBhvrAttrs = Pick<
	PptxNativeAnimation,
	'cBhvrAdditive' | 'cBhvrAccumulate' | 'cBhvrXfrmType' | 'cBhvrOverride'
>;

const ADDITIVE_VALUES: ReadonlySet<string> = new Set(['base', 'sum', 'repl', 'mult', 'none']);
const ACCUMULATE_VALUES: ReadonlySet<string> = new Set(['none', 'always']);
const XFRM_TYPE_VALUES: ReadonlySet<string> = new Set(['point', 'img']);
const OVERRIDE_VALUES: ReadonlySet<string> = new Set(['normal', 'childStyle']);

/** Extract the four `p:cBhvr` timing attributes from a behaviour's `p:cBhvr` node. */
export function extractCBhvrAttrs(cBhvr: XmlObject | undefined): CBhvrAttrs | undefined {
	if (!cBhvr) {
		return undefined;
	}
	const additive = cBhvr['@_additive'] !== undefined ? String(cBhvr['@_additive']) : undefined;
	const accumulate =
		cBhvr['@_accumulate'] !== undefined ? String(cBhvr['@_accumulate']) : undefined;
	const xfrmType = cBhvr['@_xfrmType'] !== undefined ? String(cBhvr['@_xfrmType']) : undefined;
	const override = cBhvr['@_override'] !== undefined ? String(cBhvr['@_override']) : undefined;

	const result: CBhvrAttrs = {};
	if (additive !== undefined && ADDITIVE_VALUES.has(additive)) {
		result.cBhvrAdditive = additive as CBhvrAttrs['cBhvrAdditive'];
	}
	if (accumulate !== undefined && ACCUMULATE_VALUES.has(accumulate)) {
		result.cBhvrAccumulate = accumulate as CBhvrAttrs['cBhvrAccumulate'];
	}
	if (xfrmType !== undefined && XFRM_TYPE_VALUES.has(xfrmType)) {
		result.cBhvrXfrmType = xfrmType as CBhvrAttrs['cBhvrXfrmType'];
	}
	if (override !== undefined && OVERRIDE_VALUES.has(override)) {
		result.cBhvrOverride = override as CBhvrAttrs['cBhvrOverride'];
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Find the `p:cBhvr` timing attributes belonging to the SAME winning node
 * {@link extractChildKeyframeAttrName} (`native-animation-attr-name.ts`)
 * picks, scanning the identical candidate keys in the identical priority
 * order so every derived field describes the same behaviour node.
 */
export function extractChildCBhvrAttrs(childTnList: XmlObject | undefined): CBhvrAttrs | undefined {
	if (!childTnList) {
		return undefined;
	}
	const candidateKeys = [
		'p:animEffect',
		'p:anim',
		'p:animMotion',
		'p:animRot',
		'p:animScale',
		'p:animClr',
	] as const;
	for (const key of candidateKeys) {
		for (const node of ensureArray(childTnList[key])) {
			const attrs = extractCBhvrAttrs(node['p:cBhvr'] as XmlObject | undefined);
			if (attrs) {
				return attrs;
			}
		}
	}
	return undefined;
}

/** Normalize a `p:anim/@_calcmode` value; unrecognised/absent values are `undefined`. */
export function normalizeCalcMode(raw: unknown): 'discrete' | 'lin' | 'fmla' | undefined {
	if (raw === undefined) {
		return undefined;
	}
	const value = String(raw);
	return value === 'discrete' || value === 'lin' || value === 'fmla' ? value : undefined;
}

/**
 * Find the `@_calcmode` on the SAME winning `p:anim`-family node
 * {@link extractChildKeyframeAttrName} picks its attrName from (only `p:anim`
 * itself carries `@_calcmode` per ECMA-376, but the scan mirrors the sibling
 * helper's candidate order for consistency).
 */
export function extractChildCalcMode(
	childTnList: XmlObject | undefined,
): 'discrete' | 'lin' | 'fmla' | undefined {
	if (!childTnList) {
		return undefined;
	}
	for (const node of ensureArray(childTnList['p:anim'])) {
		const calcMode = normalizeCalcMode(node['@_calcmode']);
		if (calcMode) {
			return calcMode;
		}
	}
	return undefined;
}
