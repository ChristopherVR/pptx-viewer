// @vitest-environment happy-dom
import type { ChartPartRef } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnyChart3DInteraction } from './chart3d-interaction-hooks';
import { useLatestRef, useStableChart3DInteraction } from './chart3d-interaction-hooks';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('useStableChart3DInteraction', () => {
	it('returns a permanently stable object identity across renders', () => {
		const seen: Required<AnyChart3DInteraction>[] = [];
		function Probe({ interaction }: { interaction: AnyChart3DInteraction | undefined }) {
			seen.push(useStableChart3DInteraction(interaction));
			return null;
		}
		act(() => {
			root.render(React.createElement(Probe, { interaction: { onSelect: vi.fn() } }));
		});
		act(() => {
			root.render(React.createElement(Probe, { interaction: { onSelect: vi.fn() } }));
		});
		expect(seen).toHaveLength(2);
		expect(seen[0]).toBe(seen[1]);
	});

	it('proxies calls through to the latest interaction prop', () => {
		let stable: Required<AnyChart3DInteraction> | null = null;
		function Probe({ interaction }: { interaction: AnyChart3DInteraction | undefined }) {
			stable = useStableChart3DInteraction(interaction);
			return null;
		}
		const first = vi.fn();
		act(() => {
			root.render(React.createElement(Probe, { interaction: { onSelect: first } }));
		});
		const part: ChartPartRef = { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 };
		stable?.onSelect(part);

		const second = vi.fn();
		act(() => {
			root.render(React.createElement(Probe, { interaction: { onSelect: second } }));
		});
		stable?.onSelect(part);
		expect(second).toHaveBeenCalledWith(part);
		expect(first).toHaveBeenCalledExactlyOnceWith(part);
	});

	it('is a safe no-op when the interaction is undefined', () => {
		let stable: Required<AnyChart3DInteraction> | null = null;
		function Probe({ interaction }: { interaction: AnyChart3DInteraction | undefined }) {
			stable = useStableChart3DInteraction(interaction);
			return null;
		}
		act(() => {
			root.render(React.createElement(Probe, { interaction: undefined }));
		});
		expect(() => stable?.onSelect(null)).not.toThrow();
		expect(() =>
			stable?.onValueDragPreview({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 }, 1),
		).not.toThrow();
		expect(() =>
			stable?.onValueDragCommit({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 }, 1),
		).not.toThrow();
	});
});

describe('useLatestRef', () => {
	it('always holds the most recently rendered value', () => {
		const refs: Array<React.RefObject<number>> = [];
		function Probe({ value }: { value: number }) {
			refs.push(useLatestRef(value));
			return null;
		}
		act(() => {
			root.render(React.createElement(Probe, { value: 1 }));
		});
		act(() => {
			root.render(React.createElement(Probe, { value: 2 }));
		});
		// Same ref object across renders...
		expect(refs[0]).toBe(refs[1]);
		// ...but its `.current` tracks the latest rendered value.
		expect(refs[1]?.current).toBe(2);
	});
});
