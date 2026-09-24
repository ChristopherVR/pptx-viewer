// @vitest-environment happy-dom
import type { PptxElement } from 'pptx-viewer-core';
import { _resetNativeImageSizeCacheForTests } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TiledImageLayer } from './TiledImageLayer';

const SRC = 'data:image/png;base64,tile-src';

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

function tiledElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'pic-1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tileScaleX: 0.1,
		tileScaleY: 0.25,
		imageData: SRC,
		...overrides,
	} as unknown as PptxElement;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	_resetNativeImageSizeCacheForTests();
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
	vi.unstubAllGlobals();
});

describe('tiledImageLayer', () => {
	it('renders the container-relative percentage before the native size resolves', () => {
		vi.stubGlobal('Image', FakeImage);
		act(() => {
			root.render(<TiledImageLayer element={tiledElement()} src={SRC} />);
		});
		const div = container.firstElementChild as HTMLDivElement;
		expect(div.style.backgroundSize).toBe('10% 25%');
	});

	it('switches to an absolute-pixel backgroundSize once the native size resolves', async () => {
		vi.stubGlobal('Image', FakeImage);
		act(() => {
			root.render(<TiledImageLayer element={tiledElement()} src={SRC} />);
		});
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		const div = container.firstElementChild as HTMLDivElement;
		// 800 * 0.1 = 80, 400 * 0.25 = 100.
		expect(div.style.backgroundSize).toBe('80px 100px');
	});
});
