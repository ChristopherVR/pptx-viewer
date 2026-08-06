import { createAiChatHistoryController, deckIdFromBridge } from 'pptx-viewer-shared/ai';
import type {
	PptxAiBridge,
	PptxAiChatStore,
	PptxAiChatSummary,
	PptxAiUIMessage,
} from 'pptx-viewer-shared/ai';
import { untrack } from 'svelte';

export interface AiChatHistoryDeps {
	bridge: PptxAiBridge;
	/** The live transcript (read reactively by the auto-save effect). */
	getMessages(): PptxAiUIMessage[];
	/** Replace the transcript in the chat engine (resume / new chat / clear). */
	setMessages(messages: PptxAiUIMessage[]): void;
	/** Title used until the transcript has enough text to derive one from. */
	getUntitledLabel(): string;
	/** Injectable for tests; defaults to the shared IndexedDB-first store. */
	store?: PptxAiChatStore;
}

export interface AiChatHistory {
	/** Saved chats for this deck, newest first (reactive). */
	readonly chats: PptxAiChatSummary[];
	/** Id the running transcript is (or will be) saved under (reactive). */
	readonly activeChatId: string;
	newChat(): void;
	resumeChat(id: string): Promise<void>;
	deleteChat(id: string): Promise<void>;
	clearCurrent(): void;
}

/**
 * Chat history for the Svelte AI panel: a runes wrapper over the shared
 * framework-free `createAiChatHistoryController`. Debounce-saves the running
 * transcript under a per-deck id, lists prior chats, and swaps the active
 * transcript on resume / new chat / delete (via `deps.setMessages`).
 *
 * Registers `$effect`s, so it must be called during component initialization.
 */
export function useAiChatHistory(deps: AiChatHistoryDeps): AiChatHistory {
	let chats = $state<PptxAiChatSummary[]>([]);
	const controller = untrack(() =>
		createAiChatHistoryController({
			deckId: deckIdFromBridge(deps.bridge),
			store: deps.store,
			getMessages: () => deps.getMessages(),
			setMessages: deps.setMessages,
			untitledLabel: deps.getUntitledLabel(),
			onChatsChanged: (next) => {
				chats = next;
			},
		}),
	);
	let activeChatId = $state(untrack(() => controller.activeChatId()));
	const syncActiveId = (): void => {
		activeChatId = controller.activeChatId();
	};

	// Debounced auto-save on every transcript change (empty transcripts skipped;
	// the read is reactive so streaming updates re-run this effect).
	$effect(() => {
		deps.getMessages();
		controller.notifyMessagesChanged();
	});
	$effect(() => {
		return () => controller.dispose();
	});

	return {
		get chats() {
			return chats;
		},
		get activeChatId() {
			return activeChatId;
		},
		newChat(): void {
			controller.newChat();
			syncActiveId();
		},
		async resumeChat(id: string): Promise<void> {
			await controller.resumeChat(id);
			syncActiveId();
		},
		async deleteChat(id: string): Promise<void> {
			await controller.deleteChat(id);
			syncActiveId();
		},
		clearCurrent(): void {
			controller.clearCurrent();
		},
	};
}
