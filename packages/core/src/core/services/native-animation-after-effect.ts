import { themeColorRefFromSchemeClr } from '../color/theme-color-ref';
/**
 * Parse-side reader for PowerPoint's genuine "after animation" end-state
 * behaviour (dim-to-colour, hide-after-animation, hide-on-next-click),
 * carried as a `p:subTnLst` sibling of an entrance/emphasis effect's own
 * `p:childTnLst` (ECMA-376 S19.5.4 CT_TLCommonBehaviorData's "child style"
 * sub-timing list). See `animation-after-effect-write.ts` for the matching
 * write-side builder and the COM-measured shape both sides agree on.
 *
 * Before this existed, `p:subTnLst` was captured only as an opaque
 * round-trip blob (`native-animation-helpers.ts`'s `captureRoundTripCTnAttrs`),
 * so a genuine third-party deck's "Dim after animation" / "Hide after
 * animation" build was invisible to both the editor panel and shared
 * playback: `pptx-viewer-shared`'s `applyAfterAnimationFromEditorList` only
 * ever read this project's OWN `pptx:editorMeta` extension, which a
 * real-world file never carries.
 *
 * @module services/native-animation-after-effect
 */
import type { PptxAfterAnimationAction, PptxThemeColorRef, XmlObject } from '../types';
import { extractAttrNameFromCBhvr } from './native-animation-attr-name';
import { ensureArray } from './native-animation-helpers';

/** What {@link extractAfterAnimationFromSubTnLst} found. */
export interface ParsedAfterAnimation {
	action: PptxAfterAnimationAction;
	/** Present only for `action: 'dimToColor'`, as `#RRGGBB`. */
	color?: string;
	/** Present only for `action: 'dimToColor'` when the target is a scheme colour (`a:schemeClr`) instead of `a:srgbClr`; see {@link color}. */
	colorRef?: PptxThemeColorRef;
}

/** True when a behaviour's own `p:cTn` carries the `afterEffect` marker. */
function hasAfterEffectFlag(cTn: XmlObject | undefined): boolean {
	const raw = cTn?.['@_afterEffect'];
	return raw === '1' || raw === 'true';
}

/** `#RRGGBB` from a colour container's `<a:srgbClr val="RRGGBB"/>` child, if present. */
function extractSrgbHex(colorContainer: XmlObject | undefined): string | undefined {
	const srgb = colorContainer?.['a:srgbClr'] as XmlObject | undefined;
	const val = srgb?.['@_val'];
	return val !== undefined ? `#${String(val).toUpperCase()}` : undefined;
}

/**
 * Look for the genuine dim-to-colour shape: a `p:animClr` in `subTnLst`
 * targeting the generic `ppt_c` attribute, marked `afterEffect` on its own
 * `p:cBhvr/p:cTn`. An `<a:srgbClr>` target resolves directly to
 * {@link ParsedAfterAnimation.color}; an `<a:schemeClr>` target (no theme is
 * available at this parse layer to resolve it to sRGB with) is captured as
 * {@link ParsedAfterAnimation.colorRef} instead, for a playback consumer to
 * resolve against the deck's theme colour map.
 */
function findDimBehaviour(subTnLst: XmlObject): ParsedAfterAnimation | undefined {
	for (const node of ensureArray(subTnLst['p:animClr'])) {
		const cBhvr = node['p:cBhvr'] as XmlObject | undefined;
		if (extractAttrNameFromCBhvr(cBhvr) !== 'ppt_c') {
			continue;
		}
		if (!hasAfterEffectFlag(cBhvr?.['p:cTn'] as XmlObject | undefined)) {
			continue;
		}
		const toNode = node['p:to'] as XmlObject | undefined;
		const color = extractSrgbHex(toNode);
		if (color) {
			return { action: 'dimToColor', color };
		}
		const colorRef = themeColorRefFromSchemeClr(toNode?.['a:schemeClr'] as XmlObject | undefined);
		return colorRef ? { action: 'dimToColor', colorRef } : { action: 'dimToColor' };
	}
	return undefined;
}

/**
 * Look for the genuine hide shape: a `p:set` in `subTnLst` driving
 * `style.visibility` to `"hidden"`, marked `afterEffect` on its own
 * `p:cBhvr/p:cTn`. The distinguishing bit is `@_masterRel`: `"sameClick"`
 * hides the instant the entrance effect ends (PowerPoint's "Hide After
 * Animation"); `"nextClick"` (or its absence) waits for the next click
 * (PowerPoint's "Hide on Next Click").
 */
function findHideBehaviour(subTnLst: XmlObject): ParsedAfterAnimation | undefined {
	for (const node of ensureArray(subTnLst['p:set'])) {
		const cBhvr = node['p:cBhvr'] as XmlObject | undefined;
		if (extractAttrNameFromCBhvr(cBhvr) !== 'style.visibility') {
			continue;
		}
		const innerCTn = cBhvr?.['p:cTn'] as XmlObject | undefined;
		if (!hasAfterEffectFlag(innerCTn)) {
			continue;
		}
		const toNode = node['p:to'] as XmlObject | undefined;
		const strVal = (toNode?.['p:strVal'] as XmlObject | undefined)?.['@_val'];
		if (String(strVal ?? '').toLowerCase() !== 'hidden') {
			continue;
		}
		const action: PptxAfterAnimationAction =
			innerCTn?.['@_masterRel'] === 'sameClick' ? 'hideAfterAnimation' : 'hideOnNextClick';
		return { action };
	}
	return undefined;
}

/**
 * Decode an entrance/emphasis effect's `p:cTn/p:subTnLst` into the typed
 * "after animation" action PowerPoint's UI shows for it, or `undefined` when
 * the node carries no recognised after-effect sub-behaviour (including when
 * it has no `p:subTnLst` at all).
 */
export function extractAfterAnimationFromSubTnLst(
	cTn: XmlObject,
): ParsedAfterAnimation | undefined {
	const subTnLst = cTn['p:subTnLst'] as XmlObject | undefined;
	if (!subTnLst) {
		return undefined;
	}
	return findDimBehaviour(subTnLst) ?? findHideBehaviour(subTnLst);
}
