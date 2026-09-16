// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	rotateHandleAncestors,
	rotateHandleClipBounds,
	rotateHandleHitRect,
	rotateHandleParentMatrix,
} from './rotate-handle-dom';

function measuredBox(
	x: number,
	y: number,
	width: number,
	height: number,
	metrics: Partial<
		Pick<
			HTMLElement,
			'offsetWidth' | 'offsetHeight' | 'clientLeft' | 'clientTop' | 'clientWidth' | 'clientHeight'
		>
	> = {},
) {
	const node = document.createElement('div');
	vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, width, height));
	for (const [key, value] of Object.entries({
		offsetWidth: width,
		offsetHeight: height,
		clientLeft: 0,
		clientTop: 0,
		clientWidth: width,
		clientHeight: height,
		...metrics,
	})) {
		Object.defineProperty(node, key, { configurable: true, value });
	}
	return node;
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('rotateHandleHitRect', () => {
	it('includes every marked hit extension, but not decorative children', () => {
		const button = measuredBox(100, 50, 20, 20);
		const extension = measuredBox(92, 44, 36, 32);
		const second = measuredBox(90, 48, 12, 12);
		const stem = measuredBox(50, 40, 100, 80);
		extension.dataset.pptxHandleHit = '';
		second.dataset.pptxHandleHit = '';
		button.append(extension, second, stem);
		expect(rotateHandleHitRect(button)).toStrictEqual({
			left: 90,
			top: 44,
			right: 128,
			bottom: 76,
		});
	});

	it('uses the visible frame when no hit extension is present', () => {
		expect(rotateHandleHitRect(measuredBox(12, 34, 10, 20))).toStrictEqual({
			left: 12,
			top: 34,
			right: 22,
			bottom: 54,
		});
	});
});

describe('rotateHandleClipBounds', () => {
	it('intersects every clipping ancestor, rather than only the nearest viewport', () => {
		const outer = measuredBox(100, 50, 600, 400);
		const inner = measuredBox(80, 70, 300, 500);
		const button = document.createElement('button');
		outer.style.overflow = inner.style.overflow = 'hidden';
		document.body.append(outer);
		outer.append(inner);
		inner.append(button);
		expect(rotateHandleClipBounds(button, rotateHandleAncestors(button))).toStrictEqual({
			left: 100,
			top: 70,
			right: 380,
			bottom: 450,
		});
	});

	it('uses the scaled client box, excluding borders and scrollbar gutters', () => {
		const host = measuredBox(100, 50, 400, 240, {
			offsetWidth: 200,
			offsetHeight: 120,
			clientLeft: 2,
			clientTop: 3,
			clientWidth: 180,
			clientHeight: 90,
		});
		const button = document.createElement('button');
		host.style.overflow = 'auto';
		document.body.append(host);
		host.append(button);
		expect(rotateHandleClipBounds(button, rotateHandleAncestors(button))).toStrictEqual({
			left: 104,
			top: 56,
			right: 464,
			bottom: 236,
		});
	});

	it.each(['x', 'y'] as const)('clips only the configured %s axis', (axis) => {
		const host = measuredBox(100, 50, 400, 200);
		const button = document.createElement('button');
		host.style.overflowX = axis === 'x' ? 'clip' : 'visible';
		host.style.overflowY = axis === 'y' ? 'clip' : 'visible';
		document.body.append(host);
		host.append(button);
		expect(rotateHandleClipBounds(button, rotateHandleAncestors(button))).toStrictEqual({
			left: axis === 'x' ? 100 : 0,
			top: axis === 'y' ? 50 : 0,
			right: axis === 'x' ? 500 : window.innerWidth,
			bottom: axis === 'y' ? 250 : window.innerHeight,
		});
	});

	it('ignores non-clipping ancestors and never extends outside the browser viewport', () => {
		const outer = measuredBox(-100, -100, window.innerWidth + 200, window.innerHeight + 200);
		const inner = measuredBox(100, 100, 10, 10);
		const button = document.createElement('button');
		outer.style.overflow = 'scroll';
		inner.style.overflow = 'visible';
		document.body.append(outer);
		outer.append(inner);
		inner.append(button);
		expect(rotateHandleClipBounds(button, rotateHandleAncestors(button))).toStrictEqual({
			left: 0,
			top: 0,
			right: window.innerWidth,
			bottom: window.innerHeight,
		});
	});

	it('preserves an empty intersection when nested clipping boxes do not overlap', () => {
		const outer = measuredBox(0, 0, 100, 100);
		const inner = measuredBox(200, 200, 100, 100);
		const button = document.createElement('button');
		outer.style.overflow = inner.style.overflow = 'hidden';
		document.body.append(outer);
		outer.append(inner);
		inner.append(button);
		expect(rotateHandleClipBounds(button, rotateHandleAncestors(button))).toStrictEqual({
			left: 200,
			top: 200,
			right: 100,
			bottom: 100,
		});
	});
});

describe('rotateHandleAncestors', () => {
	it('walks only the owning hierarchy from nearest parent to document element', () => {
		const host = document.createElement('div');
		const selection = document.createElement('div');
		const button = document.createElement('button');
		document.body.append(host, document.createElement('div'));
		host.append(selection);
		selection.append(button);
		expect(rotateHandleAncestors(button)).toStrictEqual([
			selection,
			host,
			document.body,
			document.documentElement,
		]);
	});

	it('does not reposition when the environment has no DOMMatrix implementation', () => {
		vi.stubGlobal('DOMMatrix', undefined);
		const button = document.createElement('button');
		expect(rotateHandleParentMatrix(button, [])).toBeNull();
	});
});
