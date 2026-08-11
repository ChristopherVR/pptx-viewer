/**
 * Per-deck id for scoping saved AI chats.
 *
 * There is no true document id available to the viewer, so the id combines the
 * deck title with its slide count: enough to keep one deck's chats together
 * without colliding across obviously-different decks. The derivation is shared
 * with the other bindings' chat-history controllers.
 */
export { deckIdFromBridge } from 'pptx-viewer-shared/ai';
