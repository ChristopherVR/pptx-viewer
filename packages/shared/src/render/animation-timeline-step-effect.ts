/**
 * `animation-timeline-step-effect` - resolves which static effect / dynamic
 * keyframe / media command a single native animation maps to, plus the
 * dynamic-uid bookkeeping that goes with it. Split out of
 * `animation-timeline-regular-step` (itself split out of
 * `animation-timeline-builder`) to keep these modules under the file-size
 * limit. Pure extraction: no logic changed, only relocated and threaded
 * through an explicit return value instead of closure-captured locals.
 *
 * @module render/animation-timeline-step-effect
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import { buildDirectionalKeyframe } from './animation-directional';
import { resolveFilterPresetSubtype } from './animation-filter-effects';
import { isMediaCommandAnimation } from './animation-media-commands';
import type { AnimationRenderContext } from './animation-render-context';
import { buildTextStyleHoldKeyframe } from './animation-text-style-css';
import { buildColorTavKeyframe, buildOpacityTavKeyframe } from './animation-timeline-absolute';
import {
	fallbackEffectForClass,
	isTextStyleOnlyEmphasis,
} from './animation-timeline-builder-helpers';
import {
	resolveEffect,
	boxForAnimation,
	buildDynamicKeyframe,
	cssKeyframeName,
} from './animation-timeline-helpers';
import type { EffectName } from './animation-timeline-types';
import { hasAuthoredTransform } from './animation-transform-keyframes';

/** Result of resolving one step's effect / dynamic keyframe / command kind. */
export interface StepEffectResolution {
	/** Static effect name to add to the timeline's needed-keyframes set, if any. */
	effect: EffectName | undefined;
	/** CSS `@keyframes` name for this step (blank for a command step). */
	keyframe: string;
	/** Whether this step carries a `p:cmd` media command instead of a visual effect. */
	isCommand: boolean;
	/** Whether a `p:tavLst` colour ramp (not `p:animClr`) resolved this step. */
	tavColorApplied: boolean;
	/** Dynamic `@keyframes` CSS block to append, if a dynamic keyframe was built. */
	dynamicCss: string | undefined;
	/** The dynamic-uid counter value after this step consumed however many it needed. */
	nextDynamicUid: number;
	/** True when this animation maps to nothing at all and must be skipped (`continue`). */
	skip: boolean;
}

/**
 * Resolve a single native animation's effect / dynamic keyframe / command
 * kind. See `animation-timeline-builder`'s module doc for the overall
 * click-group grouping this feeds into.
 */
export function resolveStepEffect(
	singleAnim: PptxNativeAnimation,
	renderContext: AnimationRenderContext | undefined,
	dynamicUidStart: number,
	// The interactive/hover sequence builder (`animation-timeline-sequence-builder`)
	// never applied the directional-keyframe substitution below; preserved here
	// as an opt-out flag so this resolver serves both call sites identically to
	// how they behaved before being unified.
	includeDirectional: boolean = true,
): StepEffectResolution {
	let dynamicUid = dynamicUidStart;
	let dynamic = hasAuthoredTransform(singleAnim, boxForAnimation(singleAnim, renderContext))
		? buildDynamicKeyframe(singleAnim, dynamicUid++, renderContext)
		: undefined;
	let effect = dynamic ? undefined : resolveEffect(singleAnim);
	if (!effect && !dynamic) {
		dynamic = buildDynamicKeyframe(singleAnim, dynamicUid++, renderContext);
	}
	// A real `p:tavLst` keyframe list on an emphasis effect (e.g.
	// PowerPoint's "Transparency") carries the AUTHORED opacity ramp;
	// prefer it over the canned 2/3-stop static effect so a custom fade
	// timing/curve is actually honoured. Only fires for 'transparency'
	// (known opacity effect) or an unmapped emphasis (already falling
	// back to `dynamic`), never for an unrelated static effect.
	if (effect === 'transparency' || !effect) {
		const tavOpacity = buildOpacityTavKeyframe(singleAnim, 'pptx-tl-tav', dynamicUid);
		if (tavOpacity) {
			dynamic = tavOpacity;
			effect = undefined;
			dynamicUid++;
		}
	}
	// A `p:tavLst` colour ramp on a generic `p:anim` node (as opposed to
	// the dedicated `p:animClr` behaviour `buildDynamicKeyframe` already
	// tried above): only attempted once nothing else has claimed this
	// step, mirroring how the existing `colorAnimation` dynamic keyframe
	// is itself gated to unmapped presets.
	let tavColorApplied = false;
	if (!effect && !dynamic) {
		const tavColor = buildColorTavKeyframe(
			singleAnim,
			'pptx-tl-tavclr',
			dynamicUid,
			renderContext?.themeColorMap,
		);
		if (tavColor) {
			dynamic = tavColor;
			tavColorApplied = true;
			dynamicUid++;
		}
	}
	// Directional non-fly entrance/exit (wipe / split / blinds / peek):
	// honour `presetSubtype` by swapping the fixed-direction static effect
	// for a direction-aware clip-path keyframe. Fly is already redirected
	// inside resolveEffect, and non-directional effects return undefined.
	if (effect && includeDirectional) {
		// `resolveFilterPresetSubtype` returns the real `presetSubtype` when
		// present; otherwise it synthesises the equivalent numeric code from
		// `singleAnim.effectFilter`'s subtype token (filter-only decks), so a
		// directional Wipe/Barn resolved via the filter fallback still gets
		// its correct edge/orientation instead of the fixed default.
		const directional = buildDirectionalKeyframe(
			effect,
			resolveFilterPresetSubtype(singleAnim),
			dynamicUid,
		);
		if (directional) {
			dynamic = directional;
			effect = undefined;
			dynamicUid++;
		}
	}
	// A `p:cmd` media command carries no visual effect but must still be
	// sequenced so the playback layer can act on it at the right time.
	const isCommand = !effect && !dynamic && isMediaCommandAnimation(singleAnim);
	let skip = false;
	if (!effect && !dynamic && !isCommand) {
		if (isTextStyleOnlyEmphasis(singleAnim)) {
			// Bold Reveal / Underline / Style Emphasis: the `textStyle`
			// override is the whole effect, so hold the element still
			// instead of layering the neutral pulse on top of it.
			dynamic = buildTextStyleHoldKeyframe(dynamicUid++);
		} else {
			// Unmapped preset: fall back so an entrance is still hidden until
			// its start and an exit still hides, rather than being dropped.
			effect = fallbackEffectForClass(singleAnim.presetClass);
			if (!effect) {
				skip = true;
			}
		}
	}

	let keyframe = '';
	if (!skip && !isCommand) {
		keyframe = effect ? cssKeyframeName(effect) : dynamic!.keyframeName;
	}

	return {
		effect: skip ? undefined : effect,
		keyframe,
		isCommand,
		tavColorApplied,
		dynamicCss: skip ? undefined : dynamic?.css,
		nextDynamicUid: dynamicUid,
		skip,
	};
}
