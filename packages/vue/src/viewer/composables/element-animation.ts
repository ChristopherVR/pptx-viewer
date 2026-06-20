/**
 * element-animation: thin re-export shim. The pure element-animation authoring
 * helpers (add/remove a per-element entrance/emphasis/exit preset) now live in
 * `pptx-viewer-shared` (`render/animation-authoring`), consolidated with the
 * Angular authoring model. This shim preserves the exact symbols the Vue ribbon
 * and its colocated test import.
 */
export type { AnimationGroup } from 'pptx-viewer-shared';
export { applyAnimationPreset, removeElementAnimation } from 'pptx-viewer-shared';
