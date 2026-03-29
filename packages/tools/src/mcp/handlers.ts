import { readFile, writeFile } from 'node:fs/promises';

import { PptxHandler } from 'pptx-viewer-core';
import type { PptxData } from 'pptx-viewer-core';

import type { ToolContext, ToolResult } from '../types.js';

export async function loadPptx(filePath: string): Promise<PptxData> {
	const bytes = await readFile(filePath);
	const handler = new PptxHandler();
	return handler.load(bytes.buffer as ArrayBuffer);
}

export async function savePptx(
	filePath: string,
	data: PptxData,
	originalBytes: Uint8Array,
): Promise<void> {
	const handler = new PptxHandler();
	await handler.load(originalBytes.buffer as ArrayBuffer);
	const outputBytes = await handler.save(data.slides, { headerFooter: data.headerFooter });
	await writeFile(filePath, outputBytes);
}

export async function createContext(
	filePath: string,
): Promise<{ ctx: ToolContext; rawBytes: Uint8Array }> {
	const rawBytes = new Uint8Array(await readFile(filePath));
	const pptxData = await loadPptx(filePath);
	return { ctx: { pptxData }, rawBytes };
}

/**
 * Run a tool function, saving back to disk if dirty.
 * Returns the inner result value (not the full ToolResult wrapper).
 */
export async function runMutatingTool<T>(
	filePath: string,
	fn: (ctx: ToolContext) => ToolResult<T> | Promise<ToolResult<T>>,
): Promise<T> {
	const { ctx, rawBytes } = await createContext(filePath);
	const toolResult = await fn(ctx);
	if (toolResult.dirty) {
		await savePptx(filePath, toolResult.pptxData, rawBytes);
	}
	return toolResult.result;
}
