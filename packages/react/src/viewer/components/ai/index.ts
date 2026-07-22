/**
 * Barrel for the AI chat panel. Only the lazy boundary is exported for eager
 * import; the panel body and its SDK dependencies stay behind `React.lazy`.
 */
export { AiChatPanelLazy } from './AiChatPanelLazy';
export type { AiChatPanelLazyProps } from './AiChatPanelLazy';
export { AiFocusHighlightOverlay } from './AiFocusHighlightOverlay';
export type { AiFocusHighlightOverlayProps } from './AiFocusHighlightOverlay';
export { AiChangeOverlay } from './AiChangeOverlay';
export type { AiChangeOverlayProps } from './AiChangeOverlay';
