import type { PptxData, PptxSlide, PptxElement } from 'pptx-viewer-core';

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
}

export type { PptxData, PptxSlide, PptxElement };
