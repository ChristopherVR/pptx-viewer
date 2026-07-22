/**
 * Pure helpers that flatten an AI SDK `UIMessage` into the small set of parts
 * the chat panel actually renders: assistant/user text and tool-call cards.
 *
 * `ai` is an optional peer, but this module is only ever reached through the
 * lazily-loaded {@link AiChatPanel}, so the runtime helper imports below load
 * only when the assistant is active (and the SDK is therefore installed).
 */
import { getToolOrDynamicToolName, isDynamicToolUIPart, isTextUIPart, isToolUIPart } from 'ai';
import type { UIMessage } from 'ai';

/** The message shape exchanged with the assistant. */
export type AiUiMessage = UIMessage;

/** A run of assistant/user prose. */
export interface RenderableTextPart {
	kind: 'text';
	text: string;
}

/** One tool invocation, in any of its streaming states. */
export interface RenderableToolPart {
	kind: 'tool';
	toolName: string;
	toolCallId: string;
	state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | string;
	input: unknown;
	output: unknown;
	errorText?: string;
}

export type RenderablePart = RenderableTextPart | RenderableToolPart;

interface ToolPartLike {
	toolCallId?: string;
	state?: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
}

/** A tool call whose input is finalized (ready to act on), in stream order. */
export interface ReadyToolCall {
	toolName: string;
	toolCallId: string;
	input: unknown;
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
 *
 * This drives the live "AI as a collaborator" on-canvas focus straight from the
 * message stream, which works in EVERY connection mode: in-process `model` mode
 * runs the tool loop inside the agent, so the client's `onToolCall` never fires
 * and the streamed tool parts are the only signal the client sees.
 */
export function extractReadyToolCalls(messages: AiUiMessage[]): ReadyToolCall[] {
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

/** Flatten a message's parts into the renderable subset, dropping empty text. */
export function toRenderableParts(message: AiUiMessage): RenderablePart[] {
	const out: RenderablePart[] = [];
	for (const part of message.parts) {
		if (isTextUIPart(part)) {
			if (part.text.trim().length > 0) {
				out.push({ kind: 'text', text: part.text });
			}
			continue;
		}
		if (isToolUIPart(part) || isDynamicToolUIPart(part)) {
			const tp = part as ToolPartLike;
			out.push({
				kind: 'tool',
				toolName: getToolOrDynamicToolName(part),
				toolCallId: tp.toolCallId ?? '',
				state: tp.state ?? 'input-streaming',
				input: tp.input,
				output: tp.output,
				errorText: tp.errorText,
			});
		}
	}
	return out;
}
