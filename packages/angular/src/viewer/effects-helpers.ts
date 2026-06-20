/**
 * Thin re-export shim → vendored `pptx-viewer-shared` (`render/effects-helpers`).
 *
 * The pure effects-panel state readers + enable/disable/update shapeStyle merge
 * patch builders were extracted to shared and are consumed by every binding.
 * This shim preserves the historical Angular import surface.
 */

export type {
	OuterShadowState,
	InnerShadowState,
	GlowState,
	ReflectionState,
	SoftEdgeState,
	EffectsState,
} from '../internal/shared';

export {
	effectsStateOf,
	enableOuterShadowPatch,
	disableOuterShadowPatch,
	updateOuterShadowPatch,
	enableInnerShadowPatch,
	disableInnerShadowPatch,
	updateInnerShadowPatch,
	enableGlowPatch,
	disableGlowPatch,
	updateGlowPatch,
	enableReflectionPatch,
	disableReflectionPatch,
	updateReflectionPatch,
	enableSoftEdgePatch,
	disableSoftEdgePatch,
} from '../internal/shared';
