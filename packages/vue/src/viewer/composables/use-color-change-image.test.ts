import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { useColorChangeImage } from './use-color-change-image';
import type { ClrChangeEffect } from './use-color-change-image';

// ---------------------------------------------------------------------------
// Mock the shared colour-change surface so no real canvas/DOM image is needed.
// We keep the rest of `pptx-viewer-shared` real and back the cache with a tiny
// in-memory map so the cache-reuse path is exercised faithfully.
// Defined via vi.hoisted so the hoisted vi.mock factory can reference them.
// ---------------------------------------------------------------------------

const { fakeCache, applyColorChangeMock } = vi.hoisted(() => ({
	fakeCache: new Map<string, string>(),
	applyColorChangeMock: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal<typeof import('pptx-viewer-shared')>();
	return {
		...actual,
		applyColorChange: (...args: unknown[]) => applyColorChangeMock(...args),
		getCachedResult: (key: string): string | undefined => fakeCache.get(key),
		setCachedResult: (key: string, url: string): void => {
			fakeCache.set(key, url);
		},
	};
});

const CLR: ClrChangeEffect = { clrFrom: '#00FF00', clrTo: '#FF0000' };

// Alias keeps the composable out of a `use*`-named call site in plain helpers,
// which the react-hooks linter would otherwise flag as a rules-of-hooks issue.
const runColorChange = useColorChangeImage;

/** Mount a harness component that exposes the composable's `displaySrc`. */
function mountHarness(
	src: ReturnType<typeof ref<string | undefined>>,
	clrChange: ReturnType<typeof ref<ClrChangeEffect | undefined>>,
) {
	const Harness = defineComponent({
		setup() {
			const { displaySrc } = runColorChange({ src, clrChange });
			return () => h('img', { src: displaySrc.value ?? '' });
		},
	});
	return mount(Harness);
}

describe('useColorChangeImage', () => {
	beforeEach(() => {
		fakeCache.clear();
		applyColorChangeMock.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shows the original src first, then swaps to the processed URL', async () => {
		let resolve!: (v: { dataUrl: string; width: number; height: number }) => void;
		applyColorChangeMock.mockReturnValue(
			new Promise((r) => {
				resolve = r;
			}),
		);

		const src = ref<string | undefined>('data:image/png;base64,ORIGINAL');
		const clrChange = ref<ClrChangeEffect | undefined>(CLR);
		const wrapper = mountHarness(src, clrChange);

		// Before the async work resolves, the original src is displayed.
		expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,ORIGINAL');
		expect(applyColorChangeMock).toHaveBeenCalledOnce();

		// Resolve the canvas processing -> swaps in the processed data-URL.
		resolve({ dataUrl: 'data:image/png;base64,PROCESSED', width: 1, height: 1 });
		await nextTick();
		await nextTick();
		expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,PROCESSED');
	});

	it('falls back to the original src when no clrChange effect is present', async () => {
		const src = ref<string | undefined>('data:image/png;base64,PLAIN');
		const clrChange = ref<ClrChangeEffect | undefined>(undefined);
		const wrapper = mountHarness(src, clrChange);
		await nextTick();

		expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,PLAIN');
		expect(applyColorChangeMock).not.toHaveBeenCalled();
	});

	it('falls back to the original src when processing fails', async () => {
		applyColorChangeMock.mockRejectedValue(new Error('boom'));

		const src = ref<string | undefined>('data:image/png;base64,KEEPME');
		const clrChange = ref<ClrChangeEffect | undefined>(CLR);
		const wrapper = mountHarness(src, clrChange);
		await nextTick();
		await nextTick();

		expect(wrapper.get('img').attributes('src')).toBe('data:image/png;base64,KEEPME');
	});

	it('reuses a cached result without re-processing for the same key', async () => {
		applyColorChangeMock.mockResolvedValue({
			dataUrl: 'data:image/png;base64,CACHED',
			width: 1,
			height: 1,
		});

		const src = ref<string | undefined>('data:image/png;base64,SAME');
		const clrChange = ref<ClrChangeEffect | undefined>(CLR);
		const first = mountHarness(src, clrChange);
		await nextTick();
		await nextTick();
		expect(first.get('img').attributes('src')).toBe('data:image/png;base64,CACHED');
		expect(applyColorChangeMock).toHaveBeenCalledOnce();

		// A second consumer of the identical src + effect should hit the cache.
		const src2 = ref<string | undefined>('data:image/png;base64,SAME');
		const clr2 = ref<ClrChangeEffect | undefined>(CLR);
		const second = mountHarness(src2, clr2);
		await nextTick();
		expect(second.get('img').attributes('src')).toBe('data:image/png;base64,CACHED');
		// No additional processing call: result came from the shared cache.
		expect(applyColorChangeMock).toHaveBeenCalledOnce();
	});
});
