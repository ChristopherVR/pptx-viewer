/**
 * A minimal, framework-free chat controller built on the SDK's `AbstractChat`.
 * Used by the Vanilla binding (which has no reactive runtime of its own) and by
 * unit tests. It adapts `AbstractChat` to a plain subscribe / snapshot model and
 * wires client-side tool execution through the session's executor.
 *
 * The `AbstractChat` subclass is defined at runtime from the dynamically-loaded
 * SDK, so this module has no static runtime dependency on `ai`.
 */

import type { ChatState, ChatStatus } from 'ai';

import type { PptxAiBridge } from './bridge';
import type { AiChangeAnimator } from './change-animator';
import type { PptxAiConfig, PptxAiUIMessage } from './config';
import { loadAiSdk } from './loader';
import type { ProposalStore } from './proposals';
import { createAiChatSession } from './session';

/** Immutable view of the chat at a point in time. */
export interface VanillaChatSnapshot {
	messages: PptxAiUIMessage[];
	status: ChatStatus;
	error?: Error;
}

/** Public controller returned by {@link createVanillaChat}. */
export interface VanillaChatController {
	/** Send a user text message and start the assistant response. */
	sendMessage(text: string): Promise<void>;
	/** Regenerate the last assistant message. */
	regenerate(): Promise<void>;
	/** Abort the in-flight request, keeping any generated tokens. */
	stop(): Promise<void>;
	/** Clear an error and return to the ready state. */
	clearError(): void;
	/** Current snapshot. */
	getSnapshot(): VanillaChatSnapshot;
	/** Subscribe to snapshot changes; returns an unsubscribe function. */
	subscribe(listener: (snapshot: VanillaChatSnapshot) => void): () => void;
	/** The staged-write store for the review UI. */
	readonly proposals: ProposalStore;
	/**
	 * Canvas change animator: publishes "these elements just changed" batches on
	 * every applied AI edit. The binding subscribes to reveal the slide and play
	 * the motion + glow (see the shared change-animation helpers).
	 */
	readonly changeAnimator: AiChangeAnimator;
}

interface ToolOutputArg {
	tool: string;
	toolCallId: string;
	output?: unknown;
	state?: 'output-error';
	errorText?: string;
}

/**
 * Create a Vanilla chat controller for the given bridge + config.
 *
 * @throws Error when the optional `ai` SDK is not installed.
 */
export async function createVanillaChat(options: {
	bridge: PptxAiBridge;
	config: PptxAiConfig;
}): Promise<VanillaChatController> {
	const sdk = await loadAiSdk();
	if (!sdk) {
		throw new Error('The optional "ai" SDK is not installed.');
	}
	const session = await createAiChatSession(options.bridge, options.config);
	const listeners = new Set<(snapshot: VanillaChatSnapshot) => void>();

	let messages: PptxAiUIMessage[] = [];
	let status: ChatStatus = 'ready';
	let error: Error | undefined;

	const emit = (): void => {
		const snapshot: VanillaChatSnapshot = { messages: [...messages], status, error };
		for (const listener of listeners) {
			listener(snapshot);
		}
	};

	// Callback-driven ChatState adapter: every mutation notifies subscribers.
	const state: ChatState<PptxAiUIMessage> = {
		get status() {
			return status;
		},
		set status(next: ChatStatus) {
			status = next;
			emit();
		},
		get error() {
			return error;
		},
		set error(next: Error | undefined) {
			error = next;
			emit();
		},
		get messages() {
			return messages;
		},
		set messages(next: PptxAiUIMessage[]) {
			messages = next;
			emit();
		},
		pushMessage: (message) => {
			messages.push(message);
			emit();
		},
		popMessage: () => {
			messages.pop();
			emit();
		},
		replaceMessage: (index, message) => {
			messages[index] = message;
			emit();
		},
		snapshot: (thing) => structuredClone(thing),
	};

	const ChatCtor = sdk.AbstractChat as unknown as new (
		init: Record<string, unknown>,
	) => VanillaChatBase;
	// In `model` mode the in-process agent already runs the tool loop, so we must
	// NOT wire a client-side executor (that double-stages every proposal) nor a
	// resubmit predicate. See `PptxAiChatSession.clientExecutesTools`.
	const init: Record<string, unknown> = {
		transport: session.transport,
		state,
		onError: (err: Error) => {
			options.config.onError?.(err);
		},
	};
	if (session.clientExecutesTools) {
		init.sendAutomaticallyWhen = session.sendAutomaticallyWhen;
		init.onToolCall = async (args: { toolCall: ToolCallInfo }) => {
			const { toolName, toolCallId, input } = args.toolCall;
			const addOutput = chat.addToolOutput as unknown as (arg: ToolOutputArg) => void;
			try {
				const output = await session.executeToolCall(toolName, input);
				addOutput({ tool: toolName, toolCallId, output });
			} catch (err) {
				addOutput({
					tool: toolName,
					toolCallId,
					state: 'output-error',
					errorText: err instanceof Error ? err.message : String(err),
				});
			}
		};
	}
	const chat = new ChatCtor(init);

	return {
		sendMessage: (text: string) => chat.sendMessage({ text }),
		regenerate: () => chat.regenerate(),
		stop: () => chat.stop(),
		clearError: () => chat.clearError(),
		getSnapshot: () => ({ messages: [...messages], status, error }),
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		proposals: session.proposals,
		changeAnimator: session.changeAnimator,
	};
}

interface ToolCallInfo {
	toolName: string;
	toolCallId: string;
	input: unknown;
}

/** The subset of `AbstractChat` this controller drives. */
interface VanillaChatBase {
	sendMessage(message: { text: string }): Promise<void>;
	regenerate(): Promise<void>;
	stop(): Promise<void>;
	clearError(): void;
	addToolOutput: unknown;
}
