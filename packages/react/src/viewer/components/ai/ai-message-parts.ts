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
