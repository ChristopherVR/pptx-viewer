import type { PptxElementAnimation } from 'pptx-viewer-core';
import { useCallback } from 'react';

import {
	startMotionPathPreview,
	startPreviewAnimation,
	stopPreviewAnimation,
} from '../../utils/animation-preview';

// ---------------------------------------------------------------------------
// Sub-hook arguments
// ---------------------------------------------------------------------------

interface UseAnimationPreviewArgs {
	selectedElementId: string;
	selectedElementAnimation: PptxElementAnimation | undefined;
}

// ---------------------------------------------------------------------------
// Sub-hook return type
// ---------------------------------------------------------------------------

export interface AnimationPreviewHandlers {
	handleAnimationHover: (anim: PptxElementAnimation) => void;
	handleAnimationHoverEnd: () => void;
	handlePreviewClick: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnimationPreview({
	selectedElementId,
	selectedElementAnimation,
}: UseAnimationPreviewArgs): AnimationPreviewHandlers {
	const handleAnimationHover = useCallback((anim: PptxElementAnimation) => {
		// A motion path wins over a preset: it is the effect being authored on the
		// canvas at that moment, and a fade would hide the travel entirely.
		if (anim.motionPath) {
			startMotionPathPreview(anim.elementId, anim.motionPath, {
				durationMs: anim.durationMs,
				delayMs: anim.delayMs,
				timingCurve: anim.timingCurve,
			});
			return;
		}
		const preset = anim.entrance ?? anim.emphasis ?? anim.exit;
		if (!preset || preset === 'none') {
			return;
		}
		startPreviewAnimation(anim.elementId, preset, {
			direction: anim.direction,
			durationMs: anim.durationMs ?? 500,
			timingCurve: anim.timingCurve,
		});
	}, []);

	const handleAnimationHoverEnd = useCallback(() => stopPreviewAnimation(), []);

	const handlePreviewClick = useCallback(() => {
		if (!selectedElementAnimation) {
			return;
		}
		if (selectedElementAnimation.motionPath) {
			startMotionPathPreview(selectedElementId, selectedElementAnimation.motionPath, {
				durationMs: selectedElementAnimation.durationMs,
				delayMs: selectedElementAnimation.delayMs,
				timingCurve: selectedElementAnimation.timingCurve,
			});
			return;
		}
		const preset =
			selectedElementAnimation.entrance ??
			selectedElementAnimation.emphasis ??
			selectedElementAnimation.exit;
		if (!preset || preset === 'none') {
			return;
		}
		startPreviewAnimation(selectedElementId, preset, {
			direction: selectedElementAnimation.direction,
			durationMs: selectedElementAnimation.durationMs ?? 500,
			timingCurve: selectedElementAnimation.timingCurve,
		});
	}, [selectedElementId, selectedElementAnimation]);

	return {
		handleAnimationHover,
		handleAnimationHoverEnd,
		handlePreviewClick,
	};
}
