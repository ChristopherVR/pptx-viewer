/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure gradient-picker readers + patch-builders were extracted to
 * `pptx-viewer-shared` (`render/gradient-picker.ts`) and are consumed by every
 * binding. This shim preserves the historical Angular import surface so
 * `GradientPickerComponent` and the colocated tests are unchanged.
 */
export type { GradientStop, GradientState } from '../internal/shared';
export {
	gradientStateOf,
	gradientStateFromStyle,
	hasGradientFill,
	gradientStatePatch,
	addGradientStopPatch,
	removeGradientStopPatch,
	updateGradientStopPatch,
	gradientStopColorCommitPatch,
} from '../internal/shared';
