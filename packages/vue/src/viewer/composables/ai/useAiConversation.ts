/**
 * useAiConversation: the entire client tool-loop glue between the shared
 * {@link PptxAiChatSession} and `@ai-sdk/vue`'s `useChat`.
 *
 * `useChat` owns the message list, streaming status, and transport request. On
 * each tool call we run the tool against the deck via `session.executeToolCall`
 * and hand the JSON result (or error) back with `addToolOutput`; the session's
 * `sendAutomaticallyWhen` predicate then resubmits so the model can continue.
 *
 * Everything reachable from here (including `@ai-sdk/vue`) sits inside the
 * lazily-loaded AI chat-panel chunk, so importing the viewer never forces the
 * optional SDK peers to be installed.
 */
import { useChat } from '@ai-sdk/vue';
import type { ChatStatus, UIMessage } from 'ai';
import type { PptxAiChatSession, PptxAiConfig, ProposalView } from 'pptx-viewer-shared/ai';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/** The tool call surfaced by `useChat`'s `onToolCall` (narrowed for our tools). */
interface IncomingToolCall {
	toolName: string;
	toolCallId: string;
	input: unknown;
}

/** Loosely-typed `addToolOutput` (the SDK types `tool` as a tool-name union). */
type AddToolOutput = (arg: {
	tool: string;
	toolCallId: string;
	output?: unknown;
	state?: 'output-error';
	errorText?: string;
}) => void;

export interface UseAiConversationResult {
	messages: Ref<UIMessage[]>;
	status: Ref<ChatStatus>;
	error: Ref<Error | undefined>;
	isStreaming: ComputedRef<boolean>;
	proposals: Ref<ProposalView[]>;
	send: (text: string) => void;
	stop: () => void;
	clearError: () => void;
	applyProposal: (id: string) => void;
	rejectProposal: (id: string) => void;
	acceptAllProposals: () => void;
}

export function useAiConversation(
	session: PptxAiChatSession,
	config: PptxAiConfig,
): UseAiConversationResult {
	const proposals = ref<ProposalView[]>(session.proposals.list());
	const refreshProposals = (): void => {
		proposals.value = session.proposals.list();
	};

	const chat = useChat({
		transport: session.transport,
		sendAutomaticallyWhen: session.sendAutomaticallyWhen,
		onError: (err: Error) => config.onError?.(err),
		onToolCall: async ({ toolCall }: { toolCall: unknown }) => {
			const { toolName, toolCallId, input } = toolCall as IncomingToolCall;
			const addToolOutput = chat.addToolOutput as unknown as AddToolOutput;
			try {
				const output = await session.executeToolCall(toolName, input);
				addToolOutput({ tool: toolName, toolCallId, output });
			} catch (err) {
				addToolOutput({
					tool: toolName,
					toolCallId,
					state: 'output-error',
					errorText: err instanceof Error ? err.message : String(err),
				});
			}
			// A staged proposal was likely just registered; surface it.
			refreshProposals();
		},
	});

	const isStreaming = computed(
		() => chat.status.value === 'submitted' || chat.status.value === 'streaming',
	);

	const send = (text: string): void => {
		const trimmed = text.trim();
		if (trimmed.length === 0) {
			return;
		}
		void chat.sendMessage({ text: trimmed });
	};

	const applyProposal = (id: string): void => {
		session.proposals.apply(id);
		refreshProposals();
	};
	const rejectProposal = (id: string): void => {
		session.proposals.revert(id);
		refreshProposals();
	};
	const acceptAllProposals = (): void => {
		session.proposals.acceptAll();
		refreshProposals();
	};

	return {
		messages: chat.messages,
		status: chat.status,
		error: chat.error,
		isStreaming,
		proposals,
		send,
		stop: () => void chat.stop(),
		clearError: () => chat.clearError(),
		applyProposal,
		rejectProposal,
		acceptAllProposals,
	};
}
