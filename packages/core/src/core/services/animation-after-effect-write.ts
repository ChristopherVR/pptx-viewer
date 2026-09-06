/**
 * Write-side node builder for PowerPoint's "after animation" end-state
 * behaviour (dim-to-colour, hide-after-animation, hide-on-next-click).
 * Extracted from `animation-write-node-builders.ts` to keep file sizes
 * manageable; see `native-animation-after-effect.ts` for the matching
 * parse-side reader.
 *
 * @module services/animation-after-effect-write
 */
import type { PptxElementAnimation, XmlObject } from '../types';

/**
 * Apply (or clear) PowerPoint's genuine "after animation" behaviour
 * (dim-to-colour, hide-after-animation, hide-on-next-click) as a `p:subTnLst`
 * sibling of the effect's own `p:childTnLst` (ECMA-376 S19.5.4
 * CT_TLCommonBehaviorData's optional "child style" sub-timing list).
 *
 * Only entrance/emphasis effects carry this (an exit effect already ends by
 * hiding, and a motion path has no after-state); callers gate on
 * `presetClass` before calling this.
 *
 * COM-measured against PowerPoint 2016 (2026-09-06) via the legacy,
 * WRITABLE `Shape.AnimationSettings` object model (`.Animate`,
 * `.EntryEffect`, `.AfterEffect`, `.DimColor`): PowerPoint up-converts those
 * settings into a real `p:timing` tree on save, which is the only way to get
 * a genuine reference shape, since the modern `Effect.EffectInformation`
 * object is read-only (assigning `.AfterEffect` throws; the one assignable
 * member, `.Dim.RGB`, is a silent no-op that leaves no trace in the saved
 * file). All three variants below are pinned to that captured shape
 * (`e2e/fixtures/animation-after-effect.pptx`, provenance "powerpoint"), and
 * a round trip through COM (reopen -> `Effect.EffectInformation.AfterEffect`)
 * confirms PowerPoint recognises decks this function writes. See
 * `docs/guide/limitations.md`.
 *
 * The previous approach modelled the dim case on the unrelated "Change Fill
 * Color" EMPHASIS effect's `p:animClr` (attrName `fillcolor`, placed inside
 * `p:childTnLst`), which is a different OOXML construct entirely: PowerPoint
 * never recognised it as an after-effect. The genuine shape instead:
 *  - lives in `p:subTnLst`, a SIBLING of `p:childTnLst`, not nested inside it;
 *  - targets `ppt_c` (a generic "this object's colour"), not `fillcolor`;
 *  - marks `p:cBhvr/@_override="childStyle"` and puts `@_afterEffect="1"` on
 *    the behaviour's OWN `p:cTn` (not on the entrance effect's outer `p:cTn`,
 *    where the old code and this project's own writer used to place it);
 *  - has no `@_id` of its own (PowerPoint omits it; nothing references it);
 *  - times itself via `@_masterRel` rather than a `@_delay`: `"nextClick"`
 *    for dim and hide-on-next-click (no `p:stCondLst` at all), `"sameClick"`
 *    for hide-after-animation, whose `p:stCondLst` fires on the `end` of the
 *    entrance effect's own `p:cTn` id (`<p:tn val="{entranceId}"/>`).
 */
export function applyAfterAnimationBehavior(
	effectCTn: XmlObject,
	anim: Pick<PptxElementAnimation, 'afterAnimation' | 'afterAnimationColor'>,
	shapeId: string,
): void {
	delete effectCTn['p:subTnLst'];
	// The old (incorrect) placement of this flag on the entrance/emphasis
	// effect's own outer `p:cTn`; strip it so a previously-corrupted node
	// gets cleaned up the next time it is surgically patched.
	delete effectCTn['@_afterEffect'];

	if (anim.afterAnimation === 'dimToColor' && anim.afterAnimationColor) {
		effectCTn['p:subTnLst'] = buildDimSubTnLst(shapeId, anim.afterAnimationColor);
		return;
	}
	if (anim.afterAnimation === 'hideAfterAnimation') {
		const entranceId = effectCTn['@_id'] !== undefined ? String(effectCTn['@_id']) : '0';
		effectCTn['p:subTnLst'] = buildHideSubTnLst(shapeId, 'sameClick', entranceId);
		return;
	}
	if (anim.afterAnimation === 'hideOnNextClick') {
		effectCTn['p:subTnLst'] = buildHideSubTnLst(shapeId, 'nextClick');
	}
}

/** The `p:subTnLst` for a dim-to-colour after-effect (see module doc). */
function buildDimSubTnLst(shapeId: string, colorHex: string): XmlObject {
	const hex = colorHex.replace(/^#/u, '').toUpperCase();
	return {
		'p:animClr': {
			'@_clrSpc': 'rgb',
			'@_dir': 'cw',
			'p:cBhvr': {
				'@_override': 'childStyle',
				'p:cTn': {
					'@_dur': '1',
					'@_fill': 'hold',
					'@_display': '0',
					'@_masterRel': 'nextClick',
					'@_afterEffect': '1',
				},
				'p:tgtEl': { 'p:spTgt': { '@_spid': shapeId } },
				'p:attrNameLst': { 'p:attrName': 'ppt_c' },
			},
			'p:to': { 'a:srgbClr': { '@_val': hex } },
		},
	};
}

/**
 * The `p:subTnLst` for a hide-after-animation (`masterRel="sameClick"`,
 * requires `entranceId` to build the `p:stCondLst/p:cond/p:tn` end-reference)
 * or hide-on-next-click (`masterRel="nextClick"`, no `p:stCondLst`) after-effect.
 */
function buildHideSubTnLst(
	shapeId: string,
	masterRel: 'sameClick' | 'nextClick',
	entranceId?: string,
): XmlObject {
	const cTn: XmlObject = {
		'@_dur': '1',
		'@_fill': 'hold',
		'@_display': '0',
		'@_masterRel': masterRel,
		'@_afterEffect': '1',
	};
	if (masterRel === 'sameClick') {
		cTn['p:stCondLst'] = {
			'p:cond': {
				'@_evt': 'end',
				'@_delay': '0',
				'p:tn': { '@_val': entranceId ?? '0' },
			},
		};
	}
	return {
		'p:set': {
			'p:cBhvr': {
				'@_override': 'childStyle',
				'p:cTn': cTn,
				'p:tgtEl': { 'p:spTgt': { '@_spid': shapeId } },
				'p:attrNameLst': { 'p:attrName': 'style.visibility' },
			},
			'p:to': { 'p:strVal': { '@_val': 'hidden' } },
		},
	};
}
