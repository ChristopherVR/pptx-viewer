/**
 * useAiHistory: chat sessions + persistence for the AI panel, backed by the
 * shared IndexedDB-first {@link createChatHistoryStore}. It debounce-saves the
 * running transcript under a per-deck id, lists prior chats, and swaps the
 * active transcript when the user resumes / starts / clears a chat.
 *
 * The transcript itself is owned by useChat (via useAiConversation); this hook
 * only reads `messages` and drives `setMessages` so switching chats stays clean.
 */
import type { PptxAiChatStore, PptxAiChatSummary, PptxAiUIMessage } from 'pptx-viewer-shared/ai';
import { createChatHistoryStore } from 'pptx-viewer-shared/ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SAVE_DEBOUNCE_MS = 800;
const TITLE_MAX = 40;

/** Fresh chat id. */
function newChatId(): string {
	return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** First user message text -> short title. */
function deriveTitle(messages: PptxAiUIMessage[]): string {
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

export interface UseAiHistoryInput {
	deckId: string;
	messages: PptxAiUIMessage[];
	setMessages: (messages: PptxAiUIMessage[]) => void;
	/** Injectable for tests; defaults to the shared IndexedDB-first store. */
	store?: PptxAiChatStore;
}

export interface UseAiHistoryResult {
	chats: PptxAiChatSummary[];
	activeChatId: string;
	refresh(): Promise<void>;
	newChat(): void;
	resumeChat(id: string): Promise<void>;
	clearCurrent(): void;
	deleteChat(id: string): Promise<void>;
}

export function useAiHistory(input: UseAiHistoryInput): UseAiHistoryResult {
	const { deckId, messages, setMessages } = input;
	const store = useMemo(() => input.store ?? createChatHistoryStore(), [input.store]);

	const [activeChatId, setActiveChatId] = useState(newChatId);
	const [chats, setChats] = useState<PptxAiChatSummary[]>([]);
	const createdAtRef = useRef<number>(Date.now());
	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const refresh = useCallback(async () => {
		setChats(await store.listChats({ deckId }));
	}, [store, deckId]);

	// Load the chat list on mount / deck change, and start a fresh chat per deck.
	useEffect(() => {
		setActiveChatId(newChatId());
		createdAtRef.current = Date.now();
		void refresh();
	}, [refresh]);

	// Debounced auto-save of the running transcript (skips empty transcripts).
	useEffect(() => {
		if (messages.length === 0) {
			return;
		}
		if (saveTimer.current) {
			clearTimeout(saveTimer.current);
		}
		saveTimer.current = setTimeout(() => {
			void (async () => {
				await store.saveChat({
					id: activeChatId,
					title: deriveTitle(messages) || 'Untitled chat',
					deckId,
					messages,
					createdAt: createdAtRef.current,
					updatedAt: Date.now(),
				});
				await refresh();
			})();
		}, SAVE_DEBOUNCE_MS);
		return () => {
			if (saveTimer.current) {
				clearTimeout(saveTimer.current);
			}
		};
	}, [messages, activeChatId, deckId, store, refresh]);

	const newChat = useCallback(() => {
		setActiveChatId(newChatId());
		createdAtRef.current = Date.now();
		setMessages([]);
	}, [setMessages]);

	const clearCurrent = useCallback(() => {
		setMessages([]);
	}, [setMessages]);

	const resumeChat = useCallback(
		async (id: string) => {
			const chat = await store.loadChat(id);
			if (!chat) {
				return;
			}
			setActiveChatId(chat.id);
			createdAtRef.current = chat.createdAt;
			setMessages(chat.messages);
		},
		[store, setMessages],
	);

	const deleteChat = useCallback(
		async (id: string) => {
			await store.deleteChat(id);
			if (id === activeChatId) {
				setActiveChatId(newChatId());
				createdAtRef.current = Date.now();
				setMessages([]);
			}
			await refresh();
		},
		[store, activeChatId, setMessages, refresh],
	);

	return { chats, activeChatId, refresh, newChat, resumeChat, clearCurrent, deleteChat };
}
