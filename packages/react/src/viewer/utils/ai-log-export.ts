/**
 * React's DOM glue for the shared detailed AI chat-log export.
 *
 * The AI settings section lets technical users download the full transcript of
 * every stored assistant chat, INCLUDING each tool call's name, input, state and
 * output/error text. The document shape, Markdown rendering, and filename
 * scheme all live in `pptx-viewer-shared/ai` (`chat-log-export.ts`); this module
 * only supplies the store lookup default and the `Blob` + anchor-click download,
 * matching the shared module's DOM-free `SaveChatLogFile` callback contract.
 */
import type { AiLogFormat, PptxAiChatStore } from 'pptx-viewer-shared/ai';
import {
	collectStoredChats,
	createChatHistoryStore,
	exportAiChatLogs as exportChatLogs,
} from 'pptx-viewer-shared/ai';

import { downloadBlob } from './dom-helpers';

export type { AiLogFormat } from 'pptx-viewer-shared/ai';

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
	const chats = await collectStoredChats(store);
	return exportChatLogs(
		chats,
		{ format: options?.format, detailed: options?.detailed, now: options?.now },
		(filename, content, mime) => {
			downloadBlob(new Blob([content], { type: mime }), filename);
		},
	);
}
