/**
 * Thin re-export shim: `TimelineEngine` (pure, stateful, no DOM/RAF) now lives
 * in `pptx-viewer-shared` (`render/animation-timeline-engine`). The RAF playback
 * loop that drives it stays in the binding (`hooks/presentation-mode`).
 */
export { TimelineEngine } from 'pptx-viewer-shared';
