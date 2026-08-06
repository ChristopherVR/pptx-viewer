/**
 * AiHistoryService: Angular signal facade over the shared framework-free
 * {@link createAiChatHistoryController}. It debounce-saves the running
 * transcript under a per-deck id, lists prior chats, and swaps the active
 * transcript when the user resumes / starts / clears a chat (mirroring the
 * React binding's `useAiHistory`).
 *
 * Provide it at the panel component level (next to `AiChatService`) so its
 * lifecycle, pending debounce included, is scoped to the open assistant.
 */
import { Injectable, signal } from '@angular/core';
import type { OnDestroy } from '@angular/core';

import { createAiChatHistoryController } from '../../internal/shared-ai';
import type {
	AiChatHistoryController,
	PptxAiChatStore,
	PptxAiChatSummary,
	PptxAiUIMessage,
} from '../../internal/shared-ai';

export interface AiHistoryInitDeps {
	deckId: string;
	getMessages(): PptxAiUIMessage[];
	setMessages(messages: PptxAiUIMessage[]): void;
	/** Injectable for tests; defaults to the shared IndexedDB-first store. */
	store?: PptxAiChatStore;
}

@Injectable()
export class AiHistoryService implements OnDestroy {
	private controller: AiChatHistoryController | null = null;

	/** Saved chats for this deck, newest first. */
	readonly chats = signal<readonly PptxAiChatSummary[]>([]);
	/** Id the running transcript is (or will be) saved under. */
	readonly activeChatId = signal('');
	/** Whether the saved-chat dropdown is open. */
	readonly menuOpen = signal(false);

	/** Component-level provider teardown: cancel any pending debounced save. */
	ngOnDestroy(): void {
		this.controller?.dispose();
	}

	/** Bootstrap the controller. Idempotent: only the first call takes effect. */
	init(deps: AiHistoryInitDeps): void {
		if (this.controller) {
			return;
		}
		this.controller = createAiChatHistoryController({
			deckId: deps.deckId,
			store: deps.store,
			getMessages: deps.getMessages,
			setMessages: deps.setMessages,
			onChatsChanged: (chats) => this.chats.set(chats),
		});
		this.syncActiveId();
	}

	/** Debounced (800ms) save of the current transcript; empty ones are skipped. */
	notifyMessagesChanged(): void {
		this.controller?.notifyMessagesChanged();
	}

	toggleMenu(): void {
		this.menuOpen.update((open) => !open);
	}

	newChat(): void {
		this.controller?.newChat();
		this.syncActiveId();
	}

	async resumeChat(id: string): Promise<void> {
		await this.controller?.resumeChat(id);
		this.syncActiveId();
	}

	async deleteChat(id: string): Promise<void> {
		await this.controller?.deleteChat(id);
		this.syncActiveId();
	}

	clearCurrent(): void {
		this.controller?.clearCurrent();
	}

	private syncActiveId(): void {
		if (this.controller) {
			this.activeChatId.set(this.controller.activeChatId());
		}
	}
}
