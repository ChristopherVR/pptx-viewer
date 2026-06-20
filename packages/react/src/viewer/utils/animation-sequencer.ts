/**
 * Thin re-export shim: `AnimationSequencer` now lives in `pptx-viewer-shared`
 * (`render/animation-sequencer`). It is pure (no DOM); `getInitialStyles`
 * returns a neutral style map that React consumers treat as `CSSProperties`.
 */
export { AnimationSequencer } from 'pptx-viewer-shared';
