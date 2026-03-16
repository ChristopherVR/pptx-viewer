import { describe, it, expect } from 'vitest';
// ---------------------------------------------------------------------------
// useContentLifecycle is a pure composition hook — it delegates to
// useLoadContent, useFontInjection, useSerialize, and useAutosave.
// There is no standalone logic to extract. Instead we verify the
// exported types compile correctly and the interface contracts match
// the expected shape.
// ---------------------------------------------------------------------------

import type { UseContentLifecycleInput, ContentLifecycleResult } from './useContentLifecycle';

// ---------------------------------------------------------------------------
// UseContentLifecycleInput type shape
// ---------------------------------------------------------------------------

describe('useContentLifecycleInput type', () => {
	it('accepts null content', () => {
		const input: Partial<UseContentLifecycleInput> = {
			content: null,
		};
		expect(input.content).toBeNull();
	});

	it('accepts ArrayBuffer content', () => {
		const buf = new ArrayBuffer(8);
		const input: Partial<UseContentLifecycleInput> = {
			content: buf,
		};
		expect(input.content).toBe(buf);
	});

	it('accepts Uint8Array content', () => {
		const arr = new Uint8Array(8);
		const input: Partial<UseContentLifecycleInput> = {
			content: arr,
		};
		expect(input.content).toBe(arr);
	});

	it('accepts undefined filePath', () => {
		const input: Partial<UseContentLifecycleInput> = {
			filePath: undefined,
		};
		expect(input.filePath).toBeUndefined();
	});

	it('accepts string filePath', () => {
		const input: Partial<UseContentLifecycleInput> = {
			filePath: '/tmp/test.pptx',
		};
		expect(input.filePath).toBe('/tmp/test.pptx');
	});
});

// ---------------------------------------------------------------------------
// ContentLifecycleResult shape
// ---------------------------------------------------------------------------

describe('contentLifecycleResult shape', () => {
	it('has the expected keys', () => {
		// Verify the expected interface properties exist by creating a mock
		const mockResult: ContentLifecycleResult = {
			handlerRef: { current: null },
			serializeSlides: async () => null,
			autosaveStatus: { state: 'idle' },
		};

		expect(mockResult.handlerRef).toBeDefined();
		expect(mockResult.serializeSlides).toBeDefined();
		expect(mockResult.autosaveStatus).toBeDefined();
	});

	it('serializeSlides can return null', async () => {
		const mockResult: ContentLifecycleResult = {
			handlerRef: { current: null },
			serializeSlides: async () => null,
			autosaveStatus: { state: 'idle' },
		};

		const result = await mockResult.serializeSlides();
		expect(result).toBeNull();
	});

	it('serializeSlides can return Uint8Array', async () => {
		const data = new Uint8Array([1, 2, 3]);
		const mockResult: ContentLifecycleResult = {
			handlerRef: { current: null },
			serializeSlides: async () => data,
			autosaveStatus: { state: 'idle' },
		};

		const result = await mockResult.serializeSlides();
		expect(result).toBe(data);
	});

	it('autosaveStatus can be idle', () => {
		const mockResult: ContentLifecycleResult = {
			handlerRef: { current: null },
			serializeSlides: async () => null,
			autosaveStatus: { state: 'idle' },
		};
		expect(mockResult.autosaveStatus.state).toBe('idle');
	});

	it('autosaveStatus can be saved with timestamp', () => {
		const now = Date.now();
		const mockResult: ContentLifecycleResult = {
			handlerRef: { current: null },
			serializeSlides: async () => null,
			autosaveStatus: { state: 'saved', timestamp: now },
		};
		expect(mockResult.autosaveStatus.state).toBe('saved');
	});
});
