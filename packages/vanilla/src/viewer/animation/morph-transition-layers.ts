import type { MorphTransitionPlan } from 'pptx-viewer-shared';
import {
	MORPH_CROSSFADE_GROUP_CSS_TEXT,
	MORPH_CROSSFADE_HALF_BLEND_MODE,
} from 'pptx-viewer-shared';

import { buildLayer } from './transition-layer';

/**
 * Strip a cloned stage down to the given element ids and drop its slide
 * background.
 *
 * Every morph layer paints a SUBSET of a slide over another layer, so it must
 * not keep that slide's own background: `getSlideBackgroundStyle` always
 * resolves to an OPAQUE fill, which would cover everything below it with a flat
 * slab for the whole transition.
 *
 * A kept shape's whole FAMILY is spared: its ancestors, and everything inside
 * it. The plan names elements at whatever level the morph matched them, so an
 * id can be a group's child (the group has to stay, or the shape this layer
 * exists to paint goes with it, and its keyframes are computed in slide space,
 * which only agrees with the DOM because children are absolutely positioned
 * inside the group's own box) or the group ITSELF (its children have to stay,
 * or the layer paints an empty box - which is what the wheel deck's centre
 * panel became the moment a whole group started dissolving as one object).
 */
export function keepOnlyElements(stage: HTMLElement, ids: readonly string[]): HTMLElement {
	stage.style.background = 'none';
	stage.style.backgroundColor = 'transparent';
	const keep = new Set(ids);
	const spared = new Set<Element>();
	for (const node of stage.querySelectorAll<HTMLElement>('[data-element-id]')) {
		const id = node.dataset.elementId;
		if (id === undefined || !keep.has(id)) {
			continue;
		}
		for (let ancestor: Element | null = node; ancestor && ancestor !== stage;) {
			spared.add(ancestor);
			ancestor = ancestor.parentElement;
		}
		for (const inside of node.querySelectorAll('[data-element-id]')) {
			spared.add(inside);
		}
	}
	for (const node of [...stage.querySelectorAll<HTMLElement>('[data-element-id]')]) {
		if (!spared.has(node)) {
			node.remove();
		}
	}
	return stage;
}

/**
 * A pair the overlay paints BOTH halves of, one isolated group per pair, so
 * the two are summed rather than stacked: two source-over fades leave the
 * ink they share at 0.75 of full strength mid-transition, which bites chunks
 * out of glyphs crossing during a text dissolve, while PowerPoint's own
 * blend keeps the two coefficients summing to 1.0 (issue #161).
 *
 * `outgoing`/`incoming` must be the ORIGINAL (unstripped) stage clones: the
 * per-pair clones this function takes are cloned again internally, BEFORE
 * `playTransitionOverlay` calls {@link keepOnlyElements} on the shared
 * `outgoing` stage to build the departing morph layer.
 */
export function buildMorphCrossfadeGroups(
	doc: Document,
	outgoing: HTMLElement,
	incoming: HTMLElement,
	morphPlan: MorphTransitionPlan | undefined,
): HTMLElement[] {
	return (morphPlan?.crossfadeGroups ?? []).map((group, index) => {
		const wrapper = doc.createElement('div');
		wrapper.dataset.pptxMorphCrossfade = group.incoming.id;
		wrapper.style.cssText = MORPH_CROSSFADE_GROUP_CSS_TEXT;
		// `isolation` makes the wrapper a stacking context, so it needs a z-index
		// of its own to stay above the ghosts its halves came from.
		wrapper.style.zIndex = String(4 + index);
		// The dissolve rides these WRAPPERS, not the elements: a pair dissolving in
		// place never moves, and an animation on the small element box gives it a
		// compositing layer whose raster snaps to whole device pixels, painting the
		// wording a fraction of a pixel off the live stage.
		const half = (
			stage: HTMLElement,
			id: string,
			state: 'outgoing' | 'lifted',
			zIndex: number,
			animation: string | undefined,
		): HTMLElement => {
			const layer = buildLayer(
				doc,
				keepOnlyElements(stage, [id]),
				zIndex,
				animation ?? 'none',
				state,
			);
			if (state === 'outgoing') {
				layer.dataset.pptxMorphOutgoing = 'true';
			} else {
				layer.dataset.pptxMorphLifted = 'true';
			}
			layer.style.mixBlendMode = MORPH_CROSSFADE_HALF_BLEND_MODE;
			return layer;
		};
		wrapper.append(
			half(
				outgoing.cloneNode(true) as HTMLElement,
				group.outgoing.id,
				'outgoing',
				0,
				group.outgoingAnimation,
			),
			half(
				incoming.cloneNode(true) as HTMLElement,
				group.incoming.id,
				'lifted',
				1,
				group.incomingAnimation,
			),
		);
		return wrapper;
	});
}
