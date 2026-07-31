import { createChatHistoryStore } from 'pptx-viewer-shared/ai';
import type { PptxAiBridge, PptxAiUIMessage } from 'pptx-viewer-shared/ai';
import { untrack } from 'svelte';

import { deckIdFromBridge, deriveChatTitle, newChatId } from './ai-history-persist';

/** How long the transcript settles before it is written back to the store. */
const SAVE_DEBOUNCE_MS = 800;

export interface ChatHistoryPersistenceDeps {
	bridge: PptxAiBridge;
	/** The live transcript (read reactively). */
	getMessages(): PptxAiUIMessage[];
	/** Title used until the transcript has enough text to derive one from. */
	getUntitledLabel(): string;
}

/**
 * Persist the running transcript to the shared chat-history store.
 *
 * Write half only: the export in File > Options > AI is what reads it back.
 * The deck id and chat id are captured once (`untrack`) so every save in a
 * session updates the same record instead of spawning a new one per keystroke,
 * and the write is debounced because the transcript changes on every streamed
 * token.
 *
 * Registers an `$effect`, so it must be called during component
 * initialization. Extracted from `AiChatPanel.svelte` to keep that file within
 * the repo's file-size budget.
 */
export function useChatHistoryPersistence(deps: ChatHistoryPersistenceDeps): void {
	const historyStore = untrack(() => createChatHistoryStore());
	const deckId = untrack(() => deckIdFromBridge(deps.bridge));
	const chatId = untrack(() => newChatId());
	const createdAt = Date.now();
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const messages = deps.getMessages();
		if (messages.length === 0) {
			return;
		}
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			void historyStore.saveChat({
				id: chatId,
				title: deriveChatTitle(messages) || deps.getUntitledLabel(),
				deckId,
				messages,
				createdAt,
				updatedAt: Date.now(),
			});
		}, SAVE_DEBOUNCE_MS);
		return () => clearTimeout(saveTimer);
	});
}
