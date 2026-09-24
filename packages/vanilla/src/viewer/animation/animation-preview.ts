/**
 * Re-export of `pptx-viewer-shared`'s `animation-ribbon-preview` module.
 *
 * This file used to hold the real implementation; it was the tightest of the
 * two bindings (vanilla, svelte) that ever played a real in-place preview
 * instead of a button highlight or a full slide-show entry, so it was lifted
 * into `pptx-viewer-shared/render/animation-ribbon-preview` verbatim for
 * react/vue/angular to share too. Kept under the original names here so the
 * ribbon tab (`ui/ribbon/tabs/animations-tab.ts`) and the inspector panel
 * (`ui/inspector/animation-panel.ts`), which both already depended on this
 * one module so the two surfaces could never drift apart, need no changes.
 */
export {
	buildAnimationRibbonPreview as buildAnimationPreview,
	playAnimationRibbonPreview as playAnimationPreview,
} from 'pptx-viewer-shared';
