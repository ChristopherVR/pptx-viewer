import { PptxHandler } from 'pptx-viewer-core';
import { describe, it, expect, vi } from 'vitest';

import { loadPresentation, savePresentation, executeToolWithContext } from '../execution.js';
import type { ExecutionContext, FileSystemProvider, ToolContext, ToolResult } from '../types.js';
import { createTestPptxBytes } from './helpers/create-test-pptx.js';

async function makeInMemoryFs(): Promise<{
	fs: FileSystemProvider;
	files: Map<string, Uint8Array>;
}> {
	const bytes = await createTestPptxBytes(2);
	const files = new Map<string, Uint8Array>();
	files.set('/test.pptx', bytes);
	const fs: FileSystemProvider = {
		readFile: async (path: string) => {
			const data = files.get(path);
			if (!data) {
				throw new Error(`File not found: ${path}`);
			}
			return data;
		},
		writeFile: async (path: string, data: Uint8Array) => {
			files.set(path, data);
		},
	};
	return { fs, files };
}

describe('loadPresentation', () => {
	it('loads PptxData from filesystem', async () => {
		const { fs } = await makeInMemoryFs();
		const ctx: ExecutionContext = { filesystem: fs };
		const { pptxData, rawBytes } = await loadPresentation('/test.pptx', ctx);
		expect(pptxData).toBeDefined();
		expect(pptxData.slides).toBeDefined();
		expect(pptxData.slides).toHaveLength(2);
		expect(rawBytes).toBeInstanceOf(Uint8Array);
		expect(rawBytes.length).toBeGreaterThan(0);
	});

	it('throws on missing file', async () => {
		const { fs } = await makeInMemoryFs();
		const ctx: ExecutionContext = { filesystem: fs };
		await expect(loadPresentation('/nonexistent.pptx', ctx)).rejects.toThrow('File not found');
	});
});

describe('savePresentation', () => {
	it('saves pptxData back to disk', async () => {
		const { fs, files } = await makeInMemoryFs();
		const ctx: ExecutionContext = { filesystem: fs };
		const { pptxData, rawBytes } = await loadPresentation('/test.pptx', ctx);

		const result = await savePresentation('/output.pptx', pptxData, rawBytes, ctx);
		expect(result.savedToDisk).toBeTruthy();
		expect(result.routedThroughCollaboration).toBeFalsy();
		expect(files.has('/output.pptx')).toBeTruthy();
		expect(files.get('/output.pptx')!.length).toBeGreaterThan(0);
	});

	it('saved file can be loaded again', async () => {
		const { fs, files } = await makeInMemoryFs();
		const ctx: ExecutionContext = { filesystem: fs };
		const { pptxData, rawBytes } = await loadPresentation('/test.pptx', ctx);

		await savePresentation('/output.pptx', pptxData, rawBytes, ctx);

		const handler = new PptxHandler();
		const reloaded = await handler.load(files.get('/output.pptx')!.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(2);
	});

	it('calls viewer.replaceContent when viewer is provided', async () => {
		const { fs } = await makeInMemoryFs();
		const replaceContent = vi.fn<() => void>();
		const ctx: ExecutionContext = {
			filesystem: fs,
			viewer: { replaceContent, openFile: vi.fn<() => void>() },
		};
		const { pptxData, rawBytes } = await loadPresentation('/test.pptx', ctx);

		await savePresentation('/test.pptx', pptxData, rawBytes, ctx);
		expect(replaceContent).toHaveBeenCalledExactlyOnceWith(
			'/test.pptx',
			expect.any(Uint8Array),
			expect.objectContaining({ markDirty: false }),
		);
	});
});

describe('executeToolWithContext', () => {
	it('executes a read-only tool (dirty=false) without saving', async () => {
		const { fs, files } = await makeInMemoryFs();
		const ctx: ExecutionContext = { filesystem: fs };

		const result = await executeToolWithContext(
			'/test.pptx',
			ctx,
			(toolCtx: ToolContext): ToolResult<{ slideCount: number }> => ({
				pptxData: toolCtx.pptxData,
				dirty: false,
				result: { slideCount: toolCtx.pptxData.slides.length },
			}),
		);

		expect(result.slideCount).toBe(2);
		// writeFile should not be called since dirty=false
		// (writeSpy is on a different object, but we can verify by checking
		// that no new files appeared beyond original)
		expect(files.size).toBe(1);
	});

	it('executes a mutating tool (dirty=true) and saves', async () => {
		const { fs } = await makeInMemoryFs();
		const ctx: ExecutionContext = { filesystem: fs };

		const result = await executeToolWithContext(
			'/test.pptx',
			ctx,
			(toolCtx: ToolContext): ToolResult<{ added: boolean }> => {
				toolCtx.pptxData.slides.push({
					...toolCtx.pptxData.slides[0],
					id: 'new-slide',
					slideNumber: 3,
				});
				return {
					pptxData: toolCtx.pptxData,
					dirty: true,
					result: { added: true },
				};
			},
		);

		expect(result.added).toBeTruthy();
		expect(result.savedToDisk).toBeTruthy();
		expect(result.routedThroughCollaboration).toBeFalsy();
	});

	it('returns tool result fields correctly', async () => {
		const { fs } = await makeInMemoryFs();
		const ctx: ExecutionContext = { filesystem: fs };

		const result = await executeToolWithContext(
			'/test.pptx',
			ctx,
			(toolCtx: ToolContext): ToolResult<{ custom: string; count: number }> => ({
				pptxData: toolCtx.pptxData,
				dirty: false,
				result: { custom: 'hello', count: 42 },
			}),
		);

		expect(result.custom).toBe('hello');
		expect(result.count).toBe(42);
	});
});
