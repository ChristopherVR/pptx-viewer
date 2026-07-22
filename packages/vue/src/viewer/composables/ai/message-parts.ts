/**
 * Pure helper that collects, in stream order, every finalized tool call across a
 * message list. Drives the live "AI as a collaborator" on-canvas focus straight
 * from the message stream, which works in EVERY connection mode: in-process
 * `model` mode runs the tool loop inside the agent, so the client's `onToolCall`
 * never fires and the streamed tool parts are the only signal the client sees.
 *
 * Replicated (small, pure) in the Vue binding rather than importing the React
 * module; the shared barrel exposes `toRenderableParts` but not this seam.
 */
import { getToolOrDynamicToolName, isDynamicToolUIPart, isToolUIPart } from 'ai';
import type { UIMessage } from 'ai';

/** A tool call whose input is finalized (ready to act on), in stream order. */
export interface ReadyToolCall {
	toolName: string;
	toolCallId: string;
	input: unknown;
}

interface ToolPartLike {
	toolCallId?: string;
	state?: string;
	input?: unknown;
}

/** Tool-part states at which the input is final (past `input-streaming`). */
const READY_TOOL_STATES: ReadonlySet<string> = new Set([
	'input-available',
	'output-available',
	'output-error',
]);

/**
 * Collect, in stream order, every tool call across `messages` whose input has
 * finalized (state past `input-streaming`) and that carries a stable id.
 */
export function extractReadyToolCalls(messages: UIMessage[]): ReadyToolCall[] {
	const out: ReadyToolCall[] = [];
	for (const message of messages) {
		for (const part of message.parts) {
			if (!isToolUIPart(part) && !isDynamicToolUIPart(part)) {
				continue;
			}
			const tp = part as ToolPartLike;
			const toolCallId = tp.toolCallId ?? '';
			if (toolCallId.length === 0 || tp.input === undefined) {
				continue;
			}
			if (!READY_TOOL_STATES.has(tp.state ?? '')) {
				continue;
			}
			out.push({ toolName: getToolOrDynamicToolName(part), toolCallId, input: tp.input });
		}
	}
	return out;
}
