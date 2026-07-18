/**
 * useAiConversation: the entire client tool-loop glue between the shared
 * {@link PptxAiChatSession} and `@ai-sdk/react`'s `useChat`.
 *
 * `useChat` owns the message list, streaming status, and transport request. On
 * each tool call we run the tool against the deck via `session.executeToolCall`
 * and hand the JSON result (or error) back with `addToolOutput`; the session's
 * `sendAutomaticallyWhen` predicate then resubmits so the model can continue.
 */
import { useChat } from '@ai-sdk/react';
import type { ChatStatus } from 'ai';
import type { PptxAiChatSession, PptxAiConfig, ProposalView } from 'pptx-viewer-shared/ai';
import { useCallback, useReducer, useRef } from 'react';

import type { AiUiMessage } from '../../components/ai/ai-message-parts';

/** The tool call surfaced by `useChat`'s `onToolCall` (narrowed for our tools). */
interface IncomingToolCall {
	toolName: string;
	toolCallId: string;
	input: unknown;
}

/** Loosely-typed `addToolOutput` (the SDK types `tool` as `never` for untyped messages). */
type AddToolOutput = (arg: {
	tool: string;
	toolCallId: string;
	output?: unknown;
	state?: 'output-error';
	errorText?: string;
}) => void;

export interface UseAiConversationResult {
	messages: AiUiMessage[];
	status: ChatStatus;
	error: Error | undefined;
	isStreaming: boolean;
	send: (text: string) => void;
	stop: () => void;
	clearError: () => void;
	proposals: ProposalView[];
	applyProposal: (id: string) => void;
	rejectProposal: (id: string) => void;
	acceptAllProposals: () => void;
}

export function useAiConversation(
	session: PptxAiChatSession,
	config: PptxAiConfig,
): UseAiConversationResult {
	const [, forceRefresh] = useReducer((n: number) => n + 1, 0);
	const chatRef = useRef<ReturnType<typeof useChat> | null>(null);

	const chat = useChat({
		transport: session.transport,
		sendAutomaticallyWhen: session.sendAutomaticallyWhen,
		onError: (err: Error) => config.onError?.(err),
		onToolCall: async ({ toolCall }: { toolCall: unknown }) => {
			const { toolName, toolCallId, input } = toolCall as IncomingToolCall;
			const current = chatRef.current;
			if (!current) {
				return;
			}
			const addToolOutput = current.addToolOutput as unknown as AddToolOutput;
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
			forceRefresh();
		},
	});
	chatRef.current = chat;

	const send = useCallback(
		(text: string) => {
			const trimmed = text.trim();
			if (trimmed.length === 0) {
				return;
			}
			void chat.sendMessage({ text: trimmed });
		},
		[chat],
	);

	const applyProposal = useCallback(
		(id: string) => {
			session.proposals.apply(id);
			forceRefresh();
		},
		[session],
	);
	const rejectProposal = useCallback(
		(id: string) => {
			session.proposals.revert(id);
			forceRefresh();
		},
		[session],
	);
	const acceptAllProposals = useCallback(() => {
		session.proposals.acceptAll();
		forceRefresh();
	}, [session]);

	return {
		messages: chat.messages as AiUiMessage[],
		status: chat.status,
		error: chat.error,
		isStreaming: chat.status === 'submitted' || chat.status === 'streaming',
		send,
		stop: () => void chat.stop(),
		clearError: () => chat.clearError(),
		proposals: session.proposals.list(),
		applyProposal,
		rejectProposal,
		acceptAllProposals,
	};
}
