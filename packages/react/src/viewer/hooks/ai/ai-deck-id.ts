/**
 * Derive a stable-ish per-deck id for scoping saved chats. There is no true
 * document id available to the viewer, so we combine the deck title (file name /
 * first-slide title) with the slide count; good enough to keep one deck's chats
 * grouped without colliding across obviously-different decks.
 */
import type { PptxAiBridge } from 'pptx-viewer-shared/ai';

export function deckIdFromBridge(bridge: PptxAiBridge): string {
	const meta = bridge.getDeckMeta();
	const title = (meta.title ?? 'deck').trim().toLowerCase().replace(/\s+/gu, '-').slice(0, 60);
	return `${title || 'deck'}::${meta.slideCount}`;
}
