/**
 * {@link createAiChatSession} - the single entry point a binding calls to wire
 * up the assistant. It loads the optional SDK, builds the tool set + executors,
 * resolves the transport for the configured connection, and returns the pieces
 * the binding feeds into its own `Chat` / `useChat` instance.
 *
 * All `ai` usage is routed through {@link loadAiSdk}; there is no static runtime
 * import of `ai` here, so importing this module never forces the peer to exist.
 */

import type { ChatTransport, ToolSet } from 'ai';

import type { PptxAiBridge } from './bridge';
import type { AiChangeAnimator } from './change-animator';
import { createAiChangeAnimator } from './change-animator';
import type { PptxAiConfig, PptxAiToolName, PptxAiUIMessage } from './config';
import { resolveChatTransport } from './config';
import { loadAiSdk } from './loader';
import { ProposalStore } from './proposals';
import { buildSystemPrompt } from './system-prompt';
import { buildToolExecutors, buildToolSet } from './tools';

/** Everything a binding needs to construct its chat instance. */
export interface PptxAiChatSession {
	/** Transport to hand to `Chat` / `useChat`. */
	transport: ChatTransport<PptxAiUIMessage>;
	/** Schema-only tool set, for client-side rendering of tool calls. */
	tools: ToolSet;
	/** Composed system prompt (base + policy + host extras). */
	systemPrompt: string;
	/** Staged-write store; drives the review UI and accept/revert actions. */
	proposals: ProposalStore;
	/**
	 * Canvas change animator: publishes "these elements just changed" batches on
	 * every applied AI edit. The binding subscribes to reveal the slide and play
	 * the motion + glow. Present regardless of config (disabled config simply
	 * never publishes), so bindings can wire it unconditionally.
	 */
	changeAnimator: AiChangeAnimator;
	/**
	 * `sendAutomaticallyWhen` predicate: resubmit once every tool call in the
	 * last assistant message has a result (client-side tool loop for endpoint
	 * connections). Wire straight into `Chat` / `useChat`.
	 */
	sendAutomaticallyWhen: (options: { messages: PptxAiUIMessage[] }) => boolean;
	/**
	 * Whether the BINDING must run the tool loop client-side (execute each tool
	 * from `onToolCall` and resubmit via {@link sendAutomaticallyWhen}).
	 *
	 * - `endpoint` / `transport`: `true`. The server (or scripted transport) owns
	 *   the model turn but cannot reach the binding's local executors + proposal
	 *   store, so the client executes tools and feeds results back.
	 * - `model`: `false`. The in-process `ToolLoopAgent` already runs the whole
	 *   tool loop locally (its tools carry `execute`), so the client must NOT
	 *   re-execute; doing so double-stages every proposal (one from the agent's
	 *   `execute`, one from the client's `onToolCall`).
	 *
	 * Bindings gate both their `onToolCall` executor and `sendAutomaticallyWhen`
	 * wiring on this flag so each tool call executes and stages EXACTLY once.
	 */
	clientExecutesTools: boolean;
	/**
	 * Execute one tool call against the deck and return its JSON-serialisable
	 * output. Throws on unknown tool or executor error. Bindings call this from
	 * their `onToolCall` handler and forward the result to `chat.addToolOutput`.
	 */
	executeToolCall(toolName: string, input: unknown): Promise<unknown>;
}

/**
 * Build an AI chat session for the given bridge + config.
 *
 * @throws Error when the optional `ai` SDK is not installed. Callers should
 *   guard with {@link isAiAvailable} and disable the AI UI when it is absent.
 */
export async function createAiChatSession(
	bridge: PptxAiBridge,
	config: PptxAiConfig,
): Promise<PptxAiChatSession> {
	const sdk = await loadAiSdk();
	if (!sdk) {
		throw new Error(
			'The optional "ai" SDK is not installed. Install `ai` (>=6 <8) to enable the assistant.',
		);
	}

	const changeAnimator = createAiChangeAnimator(config.changeAnimation);
	const proposals = new ProposalStore(bridge, changeAnimator);
	const executors = buildToolExecutors(bridge, proposals, config, changeAnimator);
	const tools = buildToolSet(sdk, config, executors, { withExecute: false });
	const systemPrompt = buildSystemPrompt({
		writePolicy: config.writePolicy ?? 'stage',
		extras: config.systemPromptExtras,
	});

	const connection = config.connection;
	const toolsWithExecute =
		connection.kind === 'model'
			? buildToolSet(sdk, config, executors, { withExecute: true })
			: undefined;
	const transport = resolveChatTransport({
		sdk,
		connection,
		toolsWithExecute,
		system: systemPrompt,
	});

	return {
		transport,
		tools,
		systemPrompt,
		proposals,
		changeAnimator,
		sendAutomaticallyWhen: sdk.lastAssistantMessageIsCompleteWithToolCalls,
		// The in-process `model` agent runs tools itself; every other connection
		// needs the binding to run them client-side. See the field doc above.
		clientExecutesTools: connection.kind !== 'model',
		async executeToolCall(toolName: string, input: unknown): Promise<unknown> {
			const executor = executors.get(toolName as PptxAiToolName);
			if (!executor) {
				throw new Error(`Unknown tool: ${toolName}`);
			}
			return executor(input);
		},
	};
}
