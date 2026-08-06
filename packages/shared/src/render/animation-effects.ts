/**
 * `animation-effects` — pure initial-style resolution for native-animation
 * entrance effects. Returns a neutral {@link AnimationStyle} (camelCase inline
 * style map); bindings cast it to their framework style type at the boundary.
 *
 * @module render/animation-effects
 */

import type { PptxAnimationPreset, PptxNativeAnimation } from 'pptx-viewer-core';

import { maskEdgeInitialStyle, maskShapeInitialStyle } from './animation-mask-reveal';
import { resolveEffect } from './animation-timeline-helpers';
import type { AnimationStyle, EffectName } from './animation-timeline-types';

// ==========================================================================
// Entrance effects that should initially hide elements
// ==========================================================================

const ENTRANCE_EFFECTS: ReadonlySet<EffectName> = new Set<EffectName>([
	'appear',
	'fadeIn',
	'flyInLeft',
	'flyInRight',
	'flyInTop',
	'flyInBottom',
	'zoomIn',
	'bounceIn',
	'wipeIn',
	'splitIn',
	'dissolveIn',
	'wheelIn',
	'blindsIn',
	'boxIn',
	'floatIn',
	'riseUp',
	'swivel',
	'expandIn',
	'checkerboardIn',
	'flashIn',
	'peekIn',
	'randomBarsIn',
	'spinnerIn',
	'growTurnIn',
]);

/**
 * Returns the initial CSS styles for an element before its entrance animation
 * plays. For mask-reveal animations the element is visible but fully masked
 * out (a mask composites with the element's own geometry `clip-path`, which a
 * `clip-path` keyframe would clobber); for all other entrances it starts fully
 * transparent.
 */
export function getInitialStyleForEffect(effect: EffectName): AnimationStyle {
	switch (effect) {
		case 'flyInLeft':
			return { opacity: 0, transform: 'translateX(-100%)' };
		case 'flyInRight':
			return { opacity: 0, transform: 'translateX(100%)' };
		case 'flyInTop':
			return { opacity: 0, transform: 'translateY(-100%)' };
		case 'flyInBottom':
			return { opacity: 0, transform: 'translateY(100%)' };
		case 'zoomIn':
			return { opacity: 0, transform: 'scale(0.3)' };
		case 'bounceIn':
			return { opacity: 0, transform: 'scale(0.3)' };
		case 'expandIn':
			return { opacity: 0, transform: 'scale(0, 0)' };
		case 'wheelIn':
			return { opacity: 0, transform: 'rotate(-360deg) scale(0.5)' };
		case 'spinnerIn':
			return { opacity: 0, transform: 'rotate(-720deg) scale(0.4)' };
		case 'growTurnIn':
			return { opacity: 0, transform: 'rotate(-90deg) scale(0.4)' };
		case 'swivel':
			return { opacity: 0, transform: 'rotateY(-90deg)' };
		case 'floatIn':
			return { opacity: 0, transform: 'translateY(40px)' };
		case 'riseUp':
			return { opacity: 0, transform: 'translateY(60px)' };
		case 'dissolveIn':
			return { opacity: 0, filter: 'blur(8px)' };
		case 'wipeIn':
			return maskEdgeInitialStyle('left');
		case 'splitIn':
			return maskShapeInitialStyle('splitHorizontalOut');
		case 'blindsIn':
			return maskEdgeInitialStyle('top');
		case 'boxIn':
			return maskShapeInitialStyle('boxOut');
		case 'peekIn':
			return maskEdgeInitialStyle('bottom');
		case 'randomBarsIn':
			return maskEdgeInitialStyle('left');
		case 'appear':
		case 'fadeIn':
		case 'checkerboardIn':
		case 'flashIn':
		default:
			return { opacity: 0 };
	}
}

// ==========================================================================
// getAnimationInitialStyle (handles all presets + native effects)
// ==========================================================================

export function getAnimationInitialStyle(
	preset: PptxAnimationPreset | undefined,
	nativeAnimation?: PptxNativeAnimation,
): AnimationStyle {
	// If a native animation is supplied, derive the initial style from its
	// preset class and preset ID.
	if (nativeAnimation) {
		const effect = resolveEffect(nativeAnimation);
		if (effect && ENTRANCE_EFFECTS.has(effect)) {
			return getInitialStyleForEffect(effect);
		}
		// Exit / emphasis effects don't change initial visibility.
		return {};
	}

	return {};
}
