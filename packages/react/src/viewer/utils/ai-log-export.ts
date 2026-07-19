/**
 * Detailed AI chat-log export for technical / debugging use.
 *
 * The AI settings section lets technical users download the full transcript of
 * every stored assistant chat, INCLUDING each tool call's name, input, state and
 * output/error text (the detail the panel only surfaces in collapsed cards). The
 * primary artifact is machine-readable JSON; a human-readable Markdown transcript
 * is also offered.
 *
 * Chats are read from the same {@link createChatHistoryStore} the panel persists
 * to (default `pptx-ai-chats` namespace), so no coupling to the panel hooks is
 * needed: this module talks to the shared store directly. `toRenderableParts`
 * (a pure shared helper) flattens each message into text runs + tool parts.
 */
import type { PptxAiChatStore, PptxAiStoredChat } from 'pptx-viewer-shared/ai';
import { createChatHistoryStore, toRenderableParts } from 'pptx-viewer-shared/ai';

import { downloadBlob } from './dom-helpers';

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
function toLogChat(chat: PptxAiStoredChat, detailed: boolean): AiLogChat {
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

function toolCallLine(call: AiLogToolCall, detailed: boolean): string {
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
export async function collectStoredChats(store: PptxAiChatStore): Promise<PptxAiStoredChat[]> {
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

/** File format to download. */
export type AiLogFormat = 'json' | 'markdown';

/** Options for {@link exportAiChatLogs}. */
export interface ExportAiChatLogsOptions {
	/** Store to read from. Defaults to the shared `createChatHistoryStore()`. */
	store?: PptxAiChatStore;
	/** `'json'` (default) or `'markdown'`. */
	format?: AiLogFormat;
	/** Include tool inputs/outputs. Default `true`. */
	detailed?: boolean;
	/** Epoch ms for the filename + `exportedAt`. Default `Date.now()`. */
	now?: number;
}

/**
 * Read all stored chats and trigger a browser download of the detailed log.
 *
 * @returns the number of chats exported. When `0`, no file is downloaded so the
 *   caller can surface an empty-state message instead.
 */
export async function exportAiChatLogs(options?: ExportAiChatLogsOptions): Promise<number> {
	const store = options?.store ?? createChatHistoryStore();
	const format = options?.format ?? 'json';
	const now = options?.now ?? Date.now();
	const chats = await collectStoredChats(store);
	if (chats.length === 0) {
		return 0;
	}
	const doc = buildChatLogExport(chats, { detailed: options?.detailed ?? true, now });
	const slug = timestampSlug(now);
	if (format === 'markdown') {
		const blob = new Blob([buildChatLogMarkdown(doc)], { type: 'text/markdown' });
		downloadBlob(blob, `pptx-ai-chats-${slug}.md`);
	} else {
		const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
		downloadBlob(blob, `pptx-ai-chats-${slug}.json`);
	}
	return chats.length;
}
