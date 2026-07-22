/**
 * Tiny helpers for persisting the running AI transcript to the shared chat
 * history store, so the "Export chat logs" settings section (and any future
 * resume UI) has data. The Svelte binding does not (yet) ship the full history
 * sidebar the React binding has; this is only the write half: a debounced save
 * of the active chat under a per-deck id.
 */
import type { PptxAiBridge, PptxAiUIMessage } from 'pptx-viewer-shared/ai';

const TITLE_MAX = 40;

/** Fresh chat id (matches the React binding's format). */
export function newChatId(): string {
	return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Derive a stable-ish per-deck id for scoping saved chats. There is no true
 * document id, so we combine the deck title with the slide count; good enough to
 * keep one deck's chats grouped without colliding across obviously-different
 * decks. Mirrors the React binding's `deckIdFromBridge`.
 */
export function deckIdFromBridge(bridge: PptxAiBridge): string {
	const meta = bridge.getDeckMeta();
	const title = (meta.title ?? 'deck').trim().toLowerCase().replace(/\s+/gu, '-').slice(0, 60);
	return `${title || 'deck'}::${meta.slideCount}`;
}

/** First user message text -> a short chat title. */
export function deriveChatTitle(messages: readonly PptxAiUIMessage[]): string {
	for (const message of messages) {
		if (message.role !== 'user') {
			continue;
		}
		const text = message.parts
			.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
			.map((p) => p.text)
			.join(' ')
			.trim();
		if (text) {
			return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX).trimEnd()}…` : text;
		}
	}
	return '';
}
