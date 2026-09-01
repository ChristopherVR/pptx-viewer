/**
 * Detailed AI chat-log export for technical / debugging use.
 *
 * The AI settings section lets technical users download the full transcript of
 * every stored assistant chat, INCLUDING each tool call's name, input, state and
 * output/error text (the detail the panel only surfaces in collapsed cards). The
 * primary artifact is machine-readable JSON; a human-readable Markdown transcript
 * is also offered.
 *
 * This module is pure and DOM-free: it never constructs a `Blob` or touches
 * `document`. The actual file write is the caller's responsibility, injected as
 * the `save` callback to {@link exportAiChatLogs}. Chats are read from a
 * {@link PptxAiChatStore} (default `createChatHistoryStore()`) via
 * {@link collectStoredChats}, kept separate from `exportAiChatLogs` so a caller
 * that already has the chats in hand (e.g. from a store it manages itself) can
 * skip the store round-trip entirely. `toRenderableParts` (a pure sibling
 * helper) flattens each message into text runs + tool parts.
 */
import { createChatHistoryStore } from './chat-history-store';
import type { PptxAiChatStore, PptxAiStoredChat } from './chat-history-store';
import { toRenderableParts } from './ui-parts';

/** One tool invocation captured with its full technical detail. */
export interface AiLogToolCall {
	toolName: string;
	toolCallId: string;
	state: string;
	input: unknown;
	output: unknown;
	errorText?: string;
}

/** One message: its role, concatenated prose, and any tool calls it made. */
export interface AiLogMessage {
	role: string;
	text: string;
	toolCalls: AiLogToolCall[];
}

/** One chat conversation in export form. */
export interface AiLogChat {
	id: string;
	title: string;
	deckId?: string;
	createdAt: number;
	updatedAt: number;
	createdAtIso: string;
	updatedAtIso: string;
	messageCount: number;
	messages: AiLogMessage[];
}

/** Top-level detailed export document. */
export interface AiLogExport {
	format: 'pptx-ai-chat-log';
	version: 1;
	exportedAt: string;
	/** Whether tool inputs/outputs are included (see `detailed` option). */
	detailed: boolean;
	chatCount: number;
	chats: AiLogChat[];
}

/** Options controlling how the export document is built. */
export interface BuildChatLogOptions {
	/** Include tool-call inputs/outputs. Default `true`. When false, tool calls
	 * still list name + state but omit the (potentially large) payloads. */
	detailed?: boolean;
	/** Epoch ms stamped as `exportedAt`. Default `Date.now()`. */
	now?: number;
}

function isoOf(ms: number): string {
	const n = Number.isFinite(ms) ? ms : 0;
	return new Date(n).toISOString();
}

/** Convert one stored chat into its detailed export form. */
export function toLogChat(chat: PptxAiStoredChat, detailed: boolean): AiLogChat {
	const messages: AiLogMessage[] = chat.messages.map((message) => {
		const parts = toRenderableParts(message);
		const textRuns: string[] = [];
		const toolCalls: AiLogToolCall[] = [];
		for (const part of parts) {
			if (part.kind === 'text') {
				textRuns.push(part.text);
				continue;
			}
			toolCalls.push({
				toolName: part.toolName,
				toolCallId: part.toolCallId,
				state: part.state,
				input: detailed ? part.input : undefined,
				output: detailed ? part.output : undefined,
				errorText: part.errorText,
			});
		}
		return {
			role: message.role,
			text: textRuns.join('\n\n'),
			toolCalls,
		};
	});
	return {
		id: chat.id,
		title: chat.title,
		deckId: chat.deckId,
		createdAt: chat.createdAt,
		updatedAt: chat.updatedAt,
		createdAtIso: isoOf(chat.createdAt),
		updatedAtIso: isoOf(chat.updatedAt),
		messageCount: chat.messages.length,
		messages,
	};
}

/** Build the detailed export document from already-loaded chats (pure). */
export function buildChatLogExport(
	chats: readonly PptxAiStoredChat[],
	options?: BuildChatLogOptions,
): AiLogExport {
	const detailed = options?.detailed ?? true;
	const now = options?.now ?? Date.now();
	return {
		format: 'pptx-ai-chat-log',
		version: 1,
		exportedAt: isoOf(now),
		detailed,
		chatCount: chats.length,
		chats: chats.map((chat) => toLogChat(chat, detailed)),
	};
}

/** Render one tool call as a Markdown bullet (+ fenced JSON when `detailed`). */
export function toolCallLine(call: AiLogToolCall, detailed: boolean): string {
	const lines = [`- Tool \`${call.toolName}\` (${call.state})`];
	if (call.errorText) {
		lines.push(`  - error: ${call.errorText}`);
	}
	if (detailed) {
		lines.push('  - input:');
		lines.push('    ```json');
		lines.push(JSON.stringify(call.input ?? null, null, 2));
		lines.push('    ```');
		lines.push('  - output:');
		lines.push('    ```json');
		lines.push(JSON.stringify(call.output ?? null, null, 2));
		lines.push('    ```');
	}
	return lines.join('\n');
}

/** Render the same detailed export as a human-readable Markdown transcript. */
export function buildChatLogMarkdown(doc: AiLogExport): string {
	const out: string[] = [
		`# AI chat logs`,
		'',
		`Exported: ${doc.exportedAt}`,
		`Chats: ${doc.chatCount}`,
		'',
	];
	for (const chat of doc.chats) {
		out.push(`## ${chat.title || chat.id}`);
		out.push('');
		out.push(`- id: ${chat.id}`);
		if (chat.deckId) {
			out.push(`- deck: ${chat.deckId}`);
		}
		out.push(`- created: ${chat.createdAtIso}`);
		out.push(`- updated: ${chat.updatedAtIso}`);
		out.push(`- messages: ${chat.messageCount}`);
		out.push('');
		for (const message of chat.messages) {
			out.push(`### ${message.role}`);
			out.push('');
			if (message.text) {
				out.push(message.text);
				out.push('');
			}
			for (const call of message.toolCalls) {
				out.push(toolCallLine(call, doc.detailed));
				out.push('');
			}
		}
	}
	return out.join('\n');
}

/** Load every stored chat (newest first) in full detail from a store. */
export async function collectStoredChats(
	store: PptxAiChatStore = createChatHistoryStore(),
): Promise<PptxAiStoredChat[]> {
	const summaries = await store.listChats();
	const chats: PptxAiStoredChat[] = [];
	for (const summary of summaries) {
		const chat = await store.loadChat(summary.id);
		if (chat) {
			chats.push(chat);
		}
	}
	return chats;
}

function timestampSlug(now: number): string {
	// YYYYMMDD-HHmmss in local time; stable, filesystem-safe.
	const d = new Date(now);
	const p = (n: number): string => String(n).padStart(2, '0');
	return (
		`${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
		`-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
	);
}

/** File format to export. */
export type AiLogFormat = 'json' | 'markdown';

/** Metadata controlling {@link exportAiChatLogs}'s output. */
export interface ExportAiChatLogsMeta {
	/** `'json'` (default) or `'markdown'`. */
	format?: AiLogFormat;
	/** Include tool inputs/outputs. Default `true`. */
	detailed?: boolean;
	/** Epoch ms for the filename + `exportedAt`. Default `Date.now()`. */
	now?: number;
}

/**
 * The DOM-touching part of a chat-log export, injected by the caller so this
 * module never constructs a `Blob` or references `document`. `content` is the
 * already-serialized file body (JSON or Markdown text); the binding decides how
 * to turn it into a download (e.g. wrap in a `Blob` and trigger an anchor click).
 */
export type SaveChatLogFile = (filename: string, content: string, mime: string) => void;

/**
 * Build the detailed export document from already-loaded chats and hand its
 * serialized body to `save`. Pure aside from that one injected callback: no
 * store access, no Blob construction, no DOM.
 *
 * @returns the number of chats exported. When `0`, `save` is not called so the
 *   caller can surface an empty-state message instead.
 */
export function exportAiChatLogs(
	chats: readonly PptxAiStoredChat[],
	meta: ExportAiChatLogsMeta | undefined,
	save: SaveChatLogFile,
): number {
	if (chats.length === 0) {
		return 0;
	}
	const now = meta?.now ?? Date.now();
	const doc = buildChatLogExport(chats, { detailed: meta?.detailed ?? true, now });
	const slug = timestampSlug(now);
	const format = meta?.format ?? 'json';
	if (format === 'markdown') {
		save(`pptx-ai-chats-${slug}.md`, buildChatLogMarkdown(doc), 'text/markdown');
	} else {
		save(`pptx-ai-chats-${slug}.json`, JSON.stringify(doc, null, 2), 'application/json');
	}
	return chats.length;
}
