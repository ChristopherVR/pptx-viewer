/**
 * useAiChatHistory: chat sessions + persistence for the AI panel, a thin Vue
 * wrapper over the shared framework-free {@link createAiChatHistoryController}.
 * It debounce-saves the running transcript under a per-deck id, lists prior
 * chats, and swaps the active transcript when the user resumes / starts /
 * clears a chat. Mirrors the React binding's `useAiHistory`.
 */
import { createAiChatHistoryController } from 'pptx-viewer-shared/ai';
import type { PptxAiChatStore, PptxAiChatSummary, PptxAiUIMessage } from 'pptx-viewer-shared/ai';
import { onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';

export interface UseAiChatHistoryInput {
	deckId: string;
	/** The live transcript owned by `useChat` (via `useAiConversation`). */
	messages: Ref<PptxAiUIMessage[]>;
	/** Replace the transcript (drives `useChat`'s message ref). */
	setMessages(messages: PptxAiUIMessage[]): void;
	/** Injectable for tests; defaults to the shared IndexedDB-first store. */
	store?: PptxAiChatStore;
	/** Localized fallback title for chats without user text yet. */
	untitledLabel?: string;
}

export interface UseAiChatHistoryResult {
	chats: Ref<PptxAiChatSummary[]>;
	activeChatId: Ref<string>;
	refresh(): Promise<void>;
	newChat(): void;
	resumeChat(id: string): Promise<void>;
	deleteChat(id: string): Promise<void>;
	clearCurrent(): void;
}

export function useAiChatHistory(input: UseAiChatHistoryInput): UseAiChatHistoryResult {
	const chats = ref<PptxAiChatSummary[]>([]);
	const controller = createAiChatHistoryController({
		deckId: input.deckId,
		store: input.store,
		getMessages: () => input.messages.value,
		setMessages: input.setMessages,
		untitledLabel: input.untitledLabel,
		onChatsChanged: (next) => {
			chats.value = next;
		},
	});
	const activeChatId = ref(controller.activeChatId());
	const syncActiveId = (): void => {
		activeChatId.value = controller.activeChatId();
	};

	// Debounced auto-save on every transcript change (empty transcripts skipped).
	watch(input.messages, () => controller.notifyMessagesChanged(), { deep: true });
	onBeforeUnmount(() => controller.dispose());

	return {
		chats,
		activeChatId,
		refresh: () => controller.refresh(),
		newChat: () => {
			controller.newChat();
			syncActiveId();
		},
		resumeChat: async (id: string) => {
			await controller.resumeChat(id);
			syncActiveId();
		},
		deleteChat: async (id: string) => {
			await controller.deleteChat(id);
			syncActiveId();
		},
		clearCurrent: () => controller.clearCurrent(),
	};
}
