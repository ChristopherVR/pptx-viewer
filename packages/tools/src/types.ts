import type { PptxData, PptxSlide, PptxElement } from 'pptx-viewer-core';
import type { Doc as YDoc } from 'yjs';

/**
 * Platform-agnostic context passed to every tool function.
 * No Electron, no RoomManager, no framework dependencies.
 */
export interface ToolContext {
	/** Current presentation data (parsed PptxData from pptx-viewer-core). */
	pptxData: PptxData;
	/** Optional: resolve external image paths to binary data. */
	resolveImage?: (path: string) => Promise<Uint8Array>;
	/** Optional: resolve external media paths to binary data. */
	resolveMedia?: (path: string) => Promise<Uint8Array>;
}

/**
 * Save-time instructions that don't live on `pptxData` itself and so cannot
 * be expressed as a model mutation: today, only `ppt/tableStyles.xml`'s
 * archive-level "repoint the default style" / "delete a style" operations
 * (`set_default_table_style`, `delete_table_style`). Mirrors the same-named
 * fields on `pptx-viewer-core`'s save options structurally (not imported, so
 * a tool result stays independent of the core package's internal type
 * export surface).
 */
export interface TableStyleSaveOptions {
	/** GUID to set as `ppt/tableStyles.xml`'s `<a:tblStyleLst @def>`. */
	tableStylesDefaultId?: string;
	/** GUIDs to remove from `ppt/tableStyles.xml` entirely. */
	tableStylesToDelete?: string[];
}

/**
 * Every tool function returns this.
 * The consumer decides what to do with the mutated pptxData.
 */
export interface ToolResult<T = unknown> {
	/** The (potentially mutated) presentation data. */
	pptxData: PptxData;
	/** Tool-specific return value (e.g., slide info, element ID, search results). */
	result: T;
	/** Whether pptxData was modified (signals need to save). */
	dirty: boolean;
	/**
	 * Extra `handler.save()` instructions this result requires beyond the
	 * ordinary `pptxData` mutation, merged in by `savePresentation` /
	 * `executeToolWithContext`. See {@link TableStyleSaveOptions}.
	 */
	saveOptions?: TableStyleSaveOptions;
}

export type { PptxData, PptxSlide, PptxElement };

// ── Collaboration / Execution provider interfaces ────────────────────────────

/**
 * Abstraction for Y.Doc room management.
 * fz-electron implements this with RoomManager.
 */
export interface CollaborationProvider {
	/** Get an active collaboration room for a file path, or null. */
	getRoom(filePath: string): { ydoc: YDoc } | null;
	/** Get the format codec for a file path, or null. */
	getCodec(filePath: string): {
		hydrate(ydoc: YDoc, bytes: Uint8Array, origin?: string): Promise<void>;
		dehydrate(ydoc: YDoc): Promise<Uint8Array>;
	} | null;
	/** Create an agent origin tag for undo isolation. */
	agentOrigin(name: string): string;
}

/**
 * Abstraction for file system access.
 * fz-electron implements this with window.electron.files.
 * MCP server implements this with node:fs.
 */
export interface FileSystemProvider {
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, data: Uint8Array): Promise<void>;
}

/**
 * Abstraction for updating an open file viewer.
 * Only fz-electron implements this.
 */
export interface ViewerProvider {
	replaceContent(
		filePath: string,
		bytes: Uint8Array,
		options: { markDirty: boolean; mimeType?: string },
	): void;
	openFile(filePath: string): Promise<void>;
}

/**
 * Full execution context for running tools with collaboration support.
 */
export interface ExecutionContext {
	/** File system for reading/writing PPTX files. */
	filesystem: FileSystemProvider;
	/** Optional collaboration provider for Y.Doc routing. */
	collaboration?: CollaborationProvider;
	/** Optional viewer integration for live document updates. */
	viewer?: ViewerProvider;
	/** Agent name for collaboration origin tracking. */
	agentName?: string;
}
