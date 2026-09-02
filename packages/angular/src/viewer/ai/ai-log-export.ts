/**
 * Angular wiring for the shared AI chat-log export. The document-building
 * logic (`buildChatLogExport` / `buildChatLogMarkdown` / `collectStoredChats`)
 * is pure and DOM-free and lives in `pptx-viewer-shared`; this file only adds
 * the two pieces that are genuinely binding-shaped: reading from a default
 * store and triggering the actual browser download via `downloadBlob`.
 */
import { downloadBlob } from '../../internal/shared';
import {
	collectStoredChats,
	createChatHistoryStore,
	exportAiChatLogs as exportAiChatLogsPure,
} from '../../internal/shared-ai';
import type { ExportAiChatLogsMeta, PptxAiChatStore } from '../../internal/shared-ai';

export {
	buildChatLogExport,
	buildChatLogMarkdown,
	collectStoredChats,
} from '../../internal/shared-ai';
export type {
	AiLogChat,
	AiLogExport,
	AiLogFormat,
	AiLogMessage,
	AiLogToolCall,
	BuildChatLogOptions,
} from '../../internal/shared-ai';

/** Options for {@link exportAiChatLogs}. */
export interface ExportAiChatLogsOptions extends ExportAiChatLogsMeta {
	/** Store to read from. Defaults to the shared `createChatHistoryStore()`. */
	store?: PptxAiChatStore;
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
	return exportAiChatLogsPure(chats, options, (filename, content, mime) => {
		downloadBlob(new Blob([content], { type: mime }), filename);
	});
}
