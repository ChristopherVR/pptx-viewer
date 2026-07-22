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
import type {
	PptxAiBridge,
	PptxAiChatSession,
	PptxAiConfig,
	PptxAiUIMessage,
	ProposalView,
	ToolCanvasTarget,
} from 'pptx-viewer-shared/ai';
import { toolCanvasTarget } from 'pptx-viewer-shared/ai';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { AiUiMessage } from '../../components/ai/ai-message-parts';
import { extractReadyToolCalls } from '../../components/ai/ai-message-parts';
import { withDeckContext } from './ai-context-transport';

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
	/** Replace the whole transcript (used to resume / start a stored chat). */
	setMessages: (messages: PptxAiUIMessage[]) => void;
	proposals: ProposalView[];
	applyProposal: (id: string) => void;
	rejectProposal: (id: string) => void;
	acceptAllProposals: () => void;
}

/** Optional hooks the panel wires in (e.g. to drive the live on-canvas focus). */
export interface UseAiConversationOptions {
	/**
	 * Called as each tool call starts, with the slide / element(s) it references
	 * (or `null` for deck-wide tools). Lets the panel navigate + highlight the
	 * canvas so the viewer reflects what the assistant is doing in real time.
	 */
	onToolTarget?: (target: ToolCanvasTarget | null) => void;
}

export function useAiConversation(
	session: PptxAiChatSession,
	config: PptxAiConfig,
	bridge: PptxAiBridge,
	options: UseAiConversationOptions = {},
): UseAiConversationResult {
	const [, forceRefresh] = useReducer((n: number) => n + 1, 0);
	const chatRef = useRef<ReturnType<typeof useChat> | null>(null);
	// Read the latest callback from a ref so useChat is not rebuilt when it changes.
	const onToolTargetRef = useRef(options.onToolTarget);
	onToolTargetRef.current = options.onToolTarget;
	// Tool calls already surfaced to the live-focus callback, so each fires the
	// canvas navigation + highlight exactly once. See the effect below.
	const seenToolCallsRef = useRef<Set<string>>(new Set());

	// In `model` mode the in-process agent runs the whole tool loop, so the
	// client must NOT execute tools (that double-stages every proposal) nor
	// resubmit. Every other connection needs the client-side loop. Gate both on
	// `session.clientExecutesTools`. See its doc in the shared session.
	const clientExecutes = session.clientExecutesTools;

	// Wrap the resolved transport so every turn carries a fresh deck + focus
	// context block (see withDeckContext). Memoised on the session so useChat is
	// not rebuilt on each render.
	const transport = useMemo(
		() => withDeckContext(session.transport, bridge, config.contextStrategy ?? 'outline'),
		[session, bridge, config.contextStrategy],
	);

	const chat = useChat({
		transport,
		sendAutomaticallyWhen: clientExecutes ? session.sendAutomaticallyWhen : undefined,
		onError: (err: Error) => config.onError?.(err),
		onToolCall: clientExecutes
			? async ({ toolCall }: { toolCall: unknown }) => {
					const { toolName, toolCallId, input } = toolCall as IncomingToolCall;
					const current = chatRef.current;
					if (!current) {
						return;
					}
					// NB: the live on-canvas focus is NOT driven from here. `onToolCall`
					// only fires when the client runs the tool loop (endpoint / transport
					// connections); in-process `model` mode never calls it. The focus is
					// instead derived from the message stream in the effect below, so it
					// mirrors the assistant in every connection mode.
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
				}
			: undefined,
	});
	chatRef.current = chat;

	// Live "AI as a collaborator" focus, driven from the message stream so it
	// works in EVERY connection mode (in `model` mode the agent runs the tool
	// loop and `onToolCall` never fires client-side). Each tool call fires the
	// focus callback exactly once, the moment its input is available: navigation
	// is NOT gated on the tool output or on a staged proposal being applied.
	// Processing in stream order means the LATEST target wins and sticks (React
	// batches the burst into one navigation, so it never snaps back).
	useEffect(() => {
		const seen = seenToolCallsRef.current;
		for (const call of extractReadyToolCalls(chat.messages as AiUiMessage[])) {
			if (seen.has(call.toolCallId)) {
				continue;
			}
			seen.add(call.toolCallId);
			onToolTargetRef.current?.(toolCanvasTarget(call.toolName, call.input));
		}
	}, [chat.messages]);

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

	const setMessages = useCallback(
		(next: PptxAiUIMessage[]) => {
			chat.setMessages(next as Parameters<typeof chat.setMessages>[0]);
			// A resumed/loaded transcript already contains completed tool calls;
			// mark them seen so opening a stored chat does not replay their canvas
			// navigation (the focus effect must only follow live, in-flight calls).
			for (const call of extractReadyToolCalls(next as AiUiMessage[])) {
				seenToolCallsRef.current.add(call.toolCallId);
			}
			// Switching chats invalidates any staged (unaccepted) proposals.
			session.proposals.clear();
			forceRefresh();
		},
		[chat, session],
	);

	return {
		messages: chat.messages as AiUiMessage[],
		status: chat.status,
		error: chat.error,
		isStreaming: chat.status === 'submitted' || chat.status === 'streaming',
		send,
		stop: () => void chat.stop(),
		setMessages,
		clearError: () => chat.clearError(),
		proposals: session.proposals.list(),
		applyProposal,
		rejectProposal,
		acceptAllProposals,
	};
}
