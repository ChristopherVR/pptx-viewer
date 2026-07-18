/**
 * Framework-agnostic helpers that flatten an AI SDK `UIMessage` into the small
 * set of parts a chat panel actually renders: assistant/user text and tool-call
 * cards. Every binding's panel (React, Vue, Angular, Svelte, Vanilla) consumes
 * these so the transcript model stays identical across bindings.
 *
 * The part-kind checks are pure structural facts of the AI SDK UI message
 * protocol (a text part has `type === 'text'`; a tool part's `type` is
 * `tool-<name>`; a dynamic tool part has `type === 'dynamic-tool'`), so this
 * module needs only a type-only import of `UIMessage` and NEVER pulls the `ai`
 * runtime. It is therefore safe to expose from the main `pptx-viewer-shared/ai`
 * barrel without forcing the optional peer to load.
 */
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

interface MessagePartLike {
	type?: string;
	text?: string;
	toolName?: string;
	toolCallId?: string;
	state?: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
}

function isTextPart(part: MessagePartLike): boolean {
	return part.type === 'text';
}

function isToolPart(part: MessagePartLike): boolean {
	return typeof part.type === 'string' && part.type.startsWith('tool-');
}

function isDynamicToolPart(part: MessagePartLike): boolean {
	return part.type === 'dynamic-tool';
}

function toolNameOf(part: MessagePartLike): string {
	if (isDynamicToolPart(part)) {
		return part.toolName ?? 'tool';
	}
	return typeof part.type === 'string' ? part.type.slice('tool-'.length) : 'tool';
}

/** Flatten a message's parts into the renderable subset, dropping empty text. */
export function toRenderableParts(message: AiUiMessage): RenderablePart[] {
	const out: RenderablePart[] = [];
	for (const rawPart of message.parts) {
		const part = rawPart as MessagePartLike;
		if (isTextPart(part)) {
			const text = part.text ?? '';
			if (text.trim().length > 0) {
				out.push({ kind: 'text', text });
			}
			continue;
		}
		if (isToolPart(part) || isDynamicToolPart(part)) {
			out.push({
				kind: 'tool',
				toolName: toolNameOf(part),
				toolCallId: part.toolCallId ?? '',
				state: part.state ?? 'input-streaming',
				input: part.input,
				output: part.output,
				errorText: part.errorText,
			});
		}
	}
	return out;
}
