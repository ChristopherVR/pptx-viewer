/**
 * Per-turn deck-context injection for the AI chat transport.
 *
 * The model only "sees" deck content if it calls read tools. To give it the
 * deck outline AND the user's focused targets automatically on every turn, we
 * wrap whatever transport the session resolved (endpoint or in-process model)
 * and, on each `sendMessages`, prepend a fresh context block to the LATEST user
 * message that is handed to the transport.
 *
 * Only the copy sent to the transport is modified: `useChat`'s own message
 * state is never mutated, so the visible transcript stays clean and the context
 * never accumulates across turns.
 */
import type { ChatTransport } from 'ai';
import type { PptxAiBridge, PptxAiContextStrategy, PptxAiUIMessage } from 'pptx-viewer-shared/ai';
import { buildDeckContext } from 'pptx-viewer-shared/ai';

/** A minimal view of a UI message part we can prepend context to. */
interface TextPart {
	type: 'text';
	text: string;
}

/**
 * Return a copy of `messages` with `context` prepended (as its own text part) to
 * the last user message. Non-mutating: the last user message is shallow-cloned
 * with a new `parts` array; all other messages are shared by reference.
 */
export function injectDeckContext(messages: PptxAiUIMessage[], context: string): PptxAiUIMessage[] {
	const lastUserIndex = findLastUserIndex(messages);
	if (lastUserIndex < 0) {
		return messages;
	}
	const target = messages[lastUserIndex];
	const contextPart: TextPart = {
		type: 'text',
		text: `Current deck context (for your reference; do not repeat it back verbatim):\n\n${context}`,
	};
	const next = messages.slice();
	next[lastUserIndex] = {
		...target,
		parts: [contextPart as PptxAiUIMessage['parts'][number], ...target.parts],
	};
	return next;
}

/** Index of the last `user` message, or -1. */
function findLastUserIndex(messages: PptxAiUIMessage[]): number {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].role === 'user') {
			return i;
		}
	}
	return -1;
}

/**
 * Wrap a transport so each turn carries a fresh deck-context block (the
 * configured {@link PptxAiContextStrategy} outline/current-slide plus the
 * bridge's focused targets). The builder caps its own token budget.
 */
export function withDeckContext(
	inner: ChatTransport<PptxAiUIMessage>,
	bridge: PptxAiBridge,
	strategy: PptxAiContextStrategy,
): ChatTransport<PptxAiUIMessage> {
	return {
		async sendMessages(options: Parameters<ChatTransport<PptxAiUIMessage>['sendMessages']>[0]) {
			if (strategy === 'none' && !bridge.getFocusedTargets) {
				return inner.sendMessages(options);
			}
			let context = '';
			try {
				context = await buildDeckContext(bridge, { strategy, focus: {} });
			} catch {
				context = '';
			}
			if (!context.trim()) {
				return inner.sendMessages(options);
			}
			return inner.sendMessages({
				...options,
				messages: injectDeckContext(options.messages, context),
			});
		},
		reconnectToStream(options: Parameters<ChatTransport<PptxAiUIMessage>['reconnectToStream']>[0]) {
			return inner.reconnectToStream(options);
		},
	};
}
