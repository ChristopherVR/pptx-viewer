/**
 * Framework-free chat-history controller for the AI panel, mirroring the React
 * binding's `useAiHistory` semantics for the other bindings (Vue / Angular /
 * Svelte / Vanilla). It debounce-saves the running transcript under a per-deck
 * id via the shared {@link createChatHistoryStore}, lists prior chats, and
 * swaps the active transcript when the user resumes / starts / clears a chat.
 *
 * The transcript itself is owned by the binding's chat engine; this controller
 * only reads it through `getMessages` and drives `setMessages`, so switching
 * chats stays clean. Bindings call {@link AiChatHistoryController.notifyMessagesChanged}
 * whenever the transcript changes (a watcher / effect / subscribe callback).
 */

import type { PptxAiBridge } from './bridge';
import { createChatHistoryStore } from './chat-history-store';
import type { PptxAiChatStore, PptxAiChatSummary } from './chat-history-store';
import type { PptxAiUIMessage } from './config';

const SAVE_DEBOUNCE_MS = 800;
const TITLE_MAX = 40;

/** Fresh chat id (matches the React binding's format). */
export function newChatId(): string {
	return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** First user message text -> a short chat title (empty when none yet). */
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

/**
 * Derive a stable-ish per-deck id for scoping saved chats. There is no true
 * document id available to the viewer, so we combine the deck title (file name /
 * first-slide title) with the slide count; good enough to keep one deck's chats
 * grouped without colliding across obviously-different decks.
 */
export function deckIdFromBridge(bridge: PptxAiBridge): string {
	const meta = bridge.getDeckMeta();
	const title = (meta.title ?? 'deck').trim().toLowerCase().replace(/\s+/gu, '-').slice(0, 60);
	return `${title || 'deck'}::${meta.slideCount}`;
}

export interface AiChatHistoryControllerDeps {
	/** Deck the chats are scoped to (see {@link deckIdFromBridge}). */
	deckId: string;
	/** Injectable for tests; defaults to the shared IndexedDB-first store. */
	store?: PptxAiChatStore;
	/** Read the live transcript from the binding's chat engine. */
	getMessages(): PptxAiUIMessage[];
	/** Replace the transcript in the binding's chat engine. */
	setMessages(messages: PptxAiUIMessage[]): void;
	/** Notified whenever the saved-chat list changes (initial load included). */
	onChatsChanged?(chats: PptxAiChatSummary[]): void;
	/** Title used when the transcript has no user text yet. */
	untitledLabel?: string;
}

export interface AiChatHistoryController {
	/** The saved chats for this deck, newest first (latest known snapshot). */
	chats(): PptxAiChatSummary[];
	/** Id the running transcript is (or will be) saved under. */
	activeChatId(): string;
	/** Re-list the saved chats from the store. */
	refresh(): Promise<void>;
	/** Debounced (800ms) save of the current transcript; empty transcripts are skipped. */
	notifyMessagesChanged(): void;
	/** Start a fresh chat: new id, cleared transcript. */
	newChat(): void;
	/** Load a stored chat and swap it in as the active transcript. */
	resumeChat(id: string): Promise<void>;
	/** Delete a stored chat (clearing the transcript when it is the active one). */
	deleteChat(id: string): Promise<void>;
	/** Clear the running transcript, keeping the active chat id. */
	clearCurrent(): void;
	/** Cancel any pending debounced save and stop notifying. */
	dispose(): void;
}

/** Create a chat-history controller. Lists the deck's chats immediately. */
export function createAiChatHistoryController(
	deps: AiChatHistoryControllerDeps,
): AiChatHistoryController {
	const store = deps.store ?? createChatHistoryStore();
	let chats: PptxAiChatSummary[] = [];
	let activeChatId = newChatId();
	let createdAt = Date.now();
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let disposed = false;

	const clearTimer = (): void => {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
	};

	const refresh = async (): Promise<void> => {
		const list = await store.listChats({ deckId: deps.deckId });
		if (disposed) {
			return;
		}
		chats = list;
		deps.onChatsChanged?.(list);
	};
	void refresh();

	const startNewChat = (): void => {
		clearTimer();
		activeChatId = newChatId();
		createdAt = Date.now();
	};

	return {
		chats: () => chats,
		activeChatId: () => activeChatId,
		refresh,
		notifyMessagesChanged(): void {
			clearTimer();
			if (disposed || deps.getMessages().length === 0) {
				return;
			}
			saveTimer = setTimeout(() => {
				saveTimer = null;
				const messages = deps.getMessages();
				if (disposed || messages.length === 0) {
					return;
				}
				void (async () => {
					await store.saveChat({
						id: activeChatId,
						title: deriveChatTitle(messages) || (deps.untitledLabel ?? 'Untitled chat'),
						deckId: deps.deckId,
						// JSON round-trip: the binding's transcript may be a framework
						// reactive proxy (Vue deep ref / Svelte $state), which the store's
						// structuredClone would reject with a DataCloneError.
						messages: JSON.parse(JSON.stringify(messages)) as PptxAiUIMessage[],
						createdAt,
						updatedAt: Date.now(),
					});
					await refresh();
				})();
			}, SAVE_DEBOUNCE_MS);
		},
		newChat(): void {
			startNewChat();
			deps.setMessages([]);
		},
		async resumeChat(id: string): Promise<void> {
			const chat = await store.loadChat(id);
			if (!chat || disposed) {
				return;
			}
			clearTimer();
			activeChatId = chat.id;
			createdAt = chat.createdAt;
			deps.setMessages(chat.messages);
		},
		async deleteChat(id: string): Promise<void> {
			await store.deleteChat(id);
			if (id === activeChatId) {
				startNewChat();
				deps.setMessages([]);
			}
			await refresh();
		},
		clearCurrent(): void {
			clearTimer();
			deps.setMessages([]);
		},
		dispose(): void {
			disposed = true;
			clearTimer();
		},
	};
}
