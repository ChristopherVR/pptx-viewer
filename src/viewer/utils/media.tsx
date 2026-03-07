/**
 * Media rendering utilities.
 *
 * Barrel re-export. Implementation split into:
 *   - media-persistent-audio.tsx  (persistent audio manager)
 *   - media-components.tsx        (metadata hook, caption renderer, placeholders, video/audio wrappers)
 *   - media-controller.tsx        (presentation media controller)
 *   - media-render.tsx            (main renderMediaElement function)
 */

export { stopAllPersistentAudio } from "./media-persistent-audio";
export { useMediaMetadataExtraction } from "./media-components";
export type { RenderMediaOptions } from "./media-render";
export { renderMediaElement } from "./media-render";
