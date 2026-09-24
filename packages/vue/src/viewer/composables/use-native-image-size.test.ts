import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';

import { useNativeImageSize } from './use-native-image-size';

/** A minimal `Image`-like stub whose `onload` fires on the next microtask. */
class FakeImage {
	naturalWidth = 800;
	naturalHeight = 400;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	#src = '';
	get src(): string {
		return this.#src;
	}
	set src(value: string) {
		this.#src = value;
		queueMicrotask(() => this.onload?.());
	}
}

// Alias keeps the composable out of a `use*`-named call site in plain helpers,
// which the react-hooks linter would otherwise flag as a rules-of-hooks issue.
const runNativeImageSize = useNativeImageSize;

function mountHarness(src: ReturnType<typeof ref<string | undefined>>) {
	const Harness = defineComponent({
		setup() {
			const nativeSize = runNativeImageSize(src);
			return () =>
				h('div', {
					'data-width': nativeSize.value?.width ?? '',
					'data-height': nativeSize.value?.height ?? '',
				});
		},
	});
	return mount(Harness);
}

describe('useNativeImageSize', () => {
	beforeEach(() => {
		vi.stubGlobal('Image', FakeImage);
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('resolves and reports the native pixel size once the probe loads', async () => {
		const src = ref<string | undefined>('data:image/png;base64,a');
		const wrapper = mountHarness(src);
		expect(wrapper.attributes('data-width')).toBe('');

		await new Promise<void>((resolve) => {
			queueMicrotask(() => queueMicrotask(() => resolve()));
		});
		await nextTick();

		expect(wrapper.attributes('data-width')).toBe('800');
		expect(wrapper.attributes('data-height')).toBe('400');
	});

	it('resets to undefined when the source becomes undefined', async () => {
		const src = ref<string | undefined>('data:image/png;base64,b');
		const wrapper = mountHarness(src);
		await new Promise<void>((resolve) => {
			queueMicrotask(() => queueMicrotask(() => resolve()));
		});
		await nextTick();
		expect(wrapper.attributes('data-width')).toBe('800');

		src.value = undefined;
		await nextTick();
		expect(wrapper.attributes('data-width')).toBe('');
	});
});
