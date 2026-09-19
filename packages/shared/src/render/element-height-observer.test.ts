// @vitest-environment happy-dom
/**
 * `observeElementHeight` tests: the initial measurement, resize updates via a
 * stubbed ResizeObserver, the dispose contract, and the no-ResizeObserver
 * fallback.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { observeElementHeight } from './element-height-observer';

function elementWithHeight(height: number): HTMLElement {
	const el = document.createElement('div');
	el.getBoundingClientRect = () => ({ height }) as DOMRect;
	return el;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('observeElementHeight', () => {
	it('reports the current height immediately', () => {
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe = vi.fn();
				disconnect = vi.fn();
			},
		);
		const onHeight = vi.fn();
		observeElementHeight(elementWithHeight(52), onHeight);
		expect(onHeight).toHaveBeenCalledExactlyOnceWith(52);
	});

	it('reports later resizes using the border-box height and stops after dispose', () => {
		let callback: ResizeObserverCallback = () => undefined;
		const disconnect = vi.fn();
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(cb: ResizeObserverCallback) {
					callback = cb;
				}
				observe = vi.fn();
				disconnect = disconnect;
			},
		);
		const onHeight = vi.fn();
		const stop = observeElementHeight(elementWithHeight(30), onHeight);
		callback(
			[{ borderBoxSize: [{ blockSize: 180 }] } as unknown as ResizeObserverEntry],
			{} as ResizeObserver,
		);
		expect(onHeight).toHaveBeenLastCalledWith(180);
		stop();
		expect(disconnect).toHaveBeenCalledOnce();
	});

	it('falls back to the element rect when the entry has no borderBoxSize', () => {
		let callback: ResizeObserverCallback = () => undefined;
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(cb: ResizeObserverCallback) {
					callback = cb;
				}
				observe = vi.fn();
				disconnect = vi.fn();
			},
		);
		const onHeight = vi.fn();
		observeElementHeight(elementWithHeight(44), onHeight);
		callback([{} as ResizeObserverEntry], {} as ResizeObserver);
		expect(onHeight).toHaveBeenLastCalledWith(44);
	});

	it('measures once and returns a no-op disposer without ResizeObserver', () => {
		vi.stubGlobal('ResizeObserver', undefined);
		const onHeight = vi.fn();
		const stop = observeElementHeight(elementWithHeight(12), onHeight);
		expect(onHeight).toHaveBeenCalledExactlyOnceWith(12);
		expect(() => stop()).not.toThrow();
	});
});
