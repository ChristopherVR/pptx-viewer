// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { useCompatibilityToastsState } from './useCompatibilityToastsState';
import type { UseCompatibilityToastsStateResult } from './useCompatibilityToastsState';

let latest: UseCompatibilityToastsStateResult | null = null;

function Harness() {
	latest = useCompatibilityToastsState();
	return null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
	act(() => root?.unmount());
	host?.remove();
	root = null;
	host = null;
	latest = null;
});

function render(): void {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	act(() => {
		root?.render(<Harness />);
	});
}

describe('useCompatibilityToastsState', () => {
	it('starts empty', () => {
		render();
		expect(latest?.toasts).toStrictEqual([]);
	});

	it('dismiss removes only the matching toast by id', () => {
		render();
		act(() => {
			latest?.setToasts([
				{ id: 'A', code: 'A', severity: 'warning', messageKey: 'k.a' },
				{ id: 'B', code: 'B', severity: 'info', messageKey: 'k.b' },
			]);
		});
		act(() => {
			latest?.dismiss('A');
		});
		expect(latest?.toasts.map((t) => t.id)).toStrictEqual(['B']);
	});

	it('dismissAll clears every toast', () => {
		render();
		act(() => {
			latest?.setToasts([
				{ id: 'A', code: 'A', severity: 'warning', messageKey: 'k.a' },
				{ id: 'B', code: 'B', severity: 'info', messageKey: 'k.b' },
			]);
		});
		act(() => {
			latest?.dismissAll();
		});
		expect(latest?.toasts).toStrictEqual([]);
	});

	it('a fresh load (setToasts) replaces dismissed state wholesale', () => {
		render();
		act(() => {
			latest?.setToasts([{ id: 'A', code: 'A', severity: 'warning', messageKey: 'k.a' }]);
			latest?.dismissAll();
		});
		act(() => {
			latest?.setToasts([{ id: 'A', code: 'A', severity: 'warning', messageKey: 'k.a' }]);
		});
		expect(latest?.toasts).toHaveLength(1);
	});
});
