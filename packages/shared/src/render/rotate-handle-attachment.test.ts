// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachRotateHandlePlacement } from './rotate-handle-attachment';
import * as dom from './rotate-handle-dom';

let button: HTMLButtonElement;
let selection: HTMLDivElement;
let stem: HTMLSpanElement;
let clipTop: number;
let mutation: () => void;
let frame: FrameRequestCallback | undefined;
let stop: (() => void) | undefined;
let quantization: number;
const disconnect = vi.fn();
const observationOptions = new Map<Node, MutationObserverInit>();

function tick() {
	mutation();
	const callback = frame;
	frame = undefined;
	callback?.(0);
}

function appliedOffset(): [number, number] {
	const values = Array.from(button.style.translate.matchAll(/\+ ([-\d.]+)px/g), (match) =>
		Number(match[1]),
	);
	return [values[0] ?? 0, values[1] ?? 0];
}

beforeEach(() => {
	clipTop = 90;
	quantization = 0;
	frame = undefined;
	observationOptions.clear();
	selection = document.createElement('div');
	button = document.createElement('button');
	stem = document.createElement('span');
	selection.append(button, stem);
	document.body.append(selection);
	selection.getBoundingClientRect = () => new DOMRect(100, 100, 200, 100);
	button.getBoundingClientRect = () => {
		const [x, y] = appliedOffset();
		return new DOMRect(194 + x + quantization, 70 + y + quantization, 12, 12);
	};
	const identity = { a: 1, b: 0, c: 0, d: 1, inverse: () => identity };
	vi.spyOn(dom, 'rotateHandleParentMatrix').mockReturnValue(identity as DOMMatrix);
	vi.spyOn(dom, 'rotateHandleClipBounds').mockImplementation(() => ({
		left: 0,
		top: clipTop,
		right: 400,
		bottom: 300,
	}));
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
		frame = callback;
		return 1;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
		frame = undefined;
	});
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			disconnect = disconnect;
		},
	);
	vi.stubGlobal(
		'MutationObserver',
		class {
			constructor(callback: () => void) {
				mutation = callback;
			}
			observe(node: Node, options: MutationObserverInit) {
				observationOptions.set(node, options);
			}
			disconnect = disconnect;
		},
	);
});

afterEach(() => {
	stop?.();
	stop = undefined;
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	disconnect.mockClear();
});

describe('attachRotateHandlePlacement', () => {
	it('leaves a visibility update owned by another caller alone on cleanup', () => {
		clipTop = 0;
		stop = attachRotateHandlePlacement(button, { stem });
		stem.style.visibility = 'hidden';
		stop();
		expect(stem.style.visibility).toBe('hidden');
	});

	it.each([false, true])(
		'keeps geometry and child mutations when the obstacle host is separate: %s',
		(separate) => {
			const controls = separate ? document.body : selection;
			stop = attachRotateHandlePlacement(button, {
				getSelectionElement: () => selection,
				getObstacleRoot: () => controls,
			});
			tick();
			expect(observationOptions.get(controls)).toStrictEqual({
				attributes: true,
				attributeFilter: ['style', 'class', 'hidden'],
				childList: true,
			});
			expect(observationOptions.get(selection)?.attributes).toBeTruthy();
		},
	);

	it('moves the full target inward and restores its canonical placement when space returns', () => {
		stop = attachRotateHandlePlacement(button, { stem });
		expect(button.style.translate).not.toBe('');
		expect(stem.style.visibility).toBe('hidden');
		clipTop = 0;
		tick();
		expect(button.style.translate).toBe('');
		expect(stem.style.visibility).toBe('');
	});

	it('freezes the relative anchor until the owning pointer ends', () => {
		stop = attachRotateHandlePlacement(button);
		const before = button.style.translate;
		button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7 }));
		clipTop = 0;
		window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8 }));
		tick();
		expect(button.style.translate).toBe(before);
		window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7 }));
		tick();
		expect(button.style.translate).toBe('');
	});

	it('settles without accumulating subpixel layout feedback', () => {
		stop = attachRotateHandlePlacement(button);
		const before = button.style.translate;
		quantization = 0.0625;
		for (let index = 0; index < 100; index += 1) {
			tick();
		}
		expect(button.style.translate).toBe(before);
	});

	it('reapplies placement after a framework replaces the button inline style', () => {
		stop = attachRotateHandlePlacement(button);
		const before = button.style.translate;
		button.style.cssText = '';
		tick();
		expect(button.style.translate).toBe(before);
	});

	it('does not substitute the parent for an unavailable selected element', () => {
		stop = attachRotateHandlePlacement(button, { getSelectionElement: () => null });
		expect(button.style.translate).toBe('');
	});

	it('does not substitute the parent for an unavailable obstacle root', () => {
		stop = attachRotateHandlePlacement(button, { getObstacleRoot: () => null });
		expect(button.style.translate).toBe('');
	});

	it('cleans up idempotently without overwriting a later owner', () => {
		stop = attachRotateHandlePlacement(button, { stem });
		button.style.translate = '3px 4px';
		stop();
		stop();
		expect(button.style.translate).toBe('3px 4px');
		expect(stem.style.visibility).toBe('');
		expect(disconnect).toHaveBeenCalledTimes(2);
		clipTop = 0;
		tick();
		expect(button.style.translate).toBe('3px 4px');
	});

	it('does not write detached nodes or a physically unplaceable control', () => {
		clipTop = 295;
		stop = attachRotateHandlePlacement(button);
		expect(button.style.translate).toBe('');
		selection.remove();
		clipTop = 90;
		tick();
		expect(button.style.translate).toBe('');
	});
});
