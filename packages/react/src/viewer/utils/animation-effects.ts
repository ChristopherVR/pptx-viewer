/**
 * Thin adapter shim: the initial-style resolution now lives in
 * `pptx-viewer-shared` (`render/animation-effects`). Shared returns a neutral
 * `AnimationStyle` (camelCase inline-style map); these wrappers re-type the
 * result as `React.CSSProperties` so React consumers/tests are unchanged.
 */
import type { PptxAnimationPreset, PptxNativeAnimation } from 'pptx-viewer-core';
import {
	getInitialStyleForEffect as sharedGetInitialStyleForEffect,
	getAnimationInitialStyle as sharedGetAnimationInitialStyle,
} from 'pptx-viewer-shared';
import type React from 'react';

import type { EffectName } from './animation-types';

export function getInitialStyleForEffect(effect: EffectName): React.CSSProperties {
	return sharedGetInitialStyleForEffect(effect) as React.CSSProperties;
}

export function getAnimationInitialStyle(
	preset: PptxAnimationPreset | undefined,
	nativeAnimation?: PptxNativeAnimation,
): React.CSSProperties {
	return sharedGetAnimationInitialStyle(preset, nativeAnimation) as React.CSSProperties;
}
