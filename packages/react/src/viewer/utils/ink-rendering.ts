/**
 * Ink rendering utilities: pressure-sensitive stroke maths + replay-animation
 * styles. The implementation is framework-agnostic and now lives in
 * `pptx-viewer-shared` (render/ink-rendering) so every binding shares one copy.
 * This module re-exports it for existing React consumers.
 *
 * @module ink-rendering
 */
export {
	extractPathPoints,
	interpolateWidth,
	generatePressureCircles,
	hasPressureVariation,
	pressuresToWidths,
	estimatePathLength,
	getInkStrokeReplayStyle,
	getInkReplayStyles,
	getContentPartReplayStyles,
	getTotalReplayDuration,
	resolveInkOpacity,
	resolveInkColor,
	resolveInkWidth,
	INK_REPLAY_KEYFRAME_NAME,
	INK_REPLAY_KEYFRAMES,
} from 'pptx-viewer-shared';
export type {
	PathPoint,
	PressureConfig,
	PressureCircle,
	InkReplayConfig,
	InkStrokeAnimationStyle,
} from 'pptx-viewer-shared';
